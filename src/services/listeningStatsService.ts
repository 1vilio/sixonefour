import { EventEmitter } from 'events';
import { databaseService, ListeningHistoryDocument, TrackDocument } from './databaseService';

export interface StatsTrackInfo {
    title: string;
    artist: string;
    url: string;
    artwork: string;
    duration: number;
}

export interface StatsResult {
    totalTracksPlayed: number;
    totalTracksPlayedChange?: number;
    mostPlayedTrack: {
        title: string;
        artist: string;
        playCount: number;
        url: string;
        artwork?: string;
        artistUrl?: string;
        change?: number;
    } | null;
    totalListeningTime: {
        hours: number;
        minutes: number;
        seconds: number;
        change?: string;
    };
    topTracks: Array<{
        title: string;
        artist: string;
        playCount: number;
        url: string;
        artwork?: string;
        artistUrl?: string;
        change?: number;
    }>;
    topArtists: Array<{
        name: string;
        playCount: number;
        url: string;
        duration: number;
        artwork?: string;
        change?: number;
    }>;
    playsPerHour: number[];
    maxTracksInDay: { count: number; date: string; duration: number };
    maxRepeats: { count: number; track: { title: string; artist: string; url: string; artistUrl?: string } | null };
    varietyScore: number;
    obsessionRate: number;
    averageTrackLength: number; // in seconds
    averageDailyListening: number; // in seconds
    consistencyScore: number; // percentage
    rediscoveries: Array<{ title: string; artist: string; playCount: number; url: string; lastPlayed: number }>;
    calendar: { [date: string]: { count: number; artworks: string[] } };
}

class ListeningStatsService {
    public events = new EventEmitter();

    public async logPlay(track: StatsTrackInfo) {
        await this.saveTrack(track);
        const historyDoc: ListeningHistoryDocument = {
            track_id: track.url,
            timestamp: Date.now(),
            listened_seconds: 0,
            is_play_count: 1,
        };
        await databaseService.logHistory(historyDoc);
        this.events.emit('stats-updated');
    }

    public async logTime(track: StatsTrackInfo, seconds: number) {
        if (seconds <= 0) return;
        await this.saveTrack(track);
        const historyDoc: ListeningHistoryDocument = {
            track_id: track.url,
            timestamp: Date.now(),
            listened_seconds: seconds,
            is_play_count: 0,
        };
        await databaseService.logHistory(historyDoc);
        this.events.emit('stats-updated');
    }

    private async saveTrack(track: StatsTrackInfo) {
        const trackDoc: TrackDocument = {
            _id: track.url,
            title: track.title,
            artist: track.artist,
            duration: track.duration,
            artwork: track.artwork,
            created_at: Date.now(),
        };
        await databaseService.saveTrack(trackDoc);
    }

    private getPreviousPeriod(
        period: 'weekly' | 'monthly' | 'thisYear' | 'allTime',
        currentStartDate: number,
    ): { start: number; end: number } | null {
        if (period === 'weekly') {
            // Previous week: from (start - 7 days) to start
            return { start: currentStartDate - 7 * 24 * 60 * 60 * 1000, end: currentStartDate };
        } else if (period === 'monthly') {
            // Previous month: from (start - 30 days) to start
            return { start: currentStartDate - 30 * 24 * 60 * 60 * 1000, end: currentStartDate };
        } else if (period === 'thisYear') {
            // Previous year: from start of prev year to start of current year
            const currentYear = new Date(currentStartDate).getFullYear();
            const startOfPrevYear = new Date(currentYear - 1, 0, 1).getTime();
            const endOfPrevYear = new Date(currentYear, 0, 1).getTime();
            return { start: startOfPrevYear, end: endOfPrevYear };
        }
        return null;
    }

    public async getStats(period: 'weekly' | 'monthly' | 'thisYear' | 'allTime'): Promise<StatsResult> {
        const now = Date.now();
        let startDate: number;
        let totalDaysInPeriod = 0;

        if (period === 'weekly') {
            startDate = now - 7 * 24 * 60 * 60 * 1000;
            totalDaysInPeriod = 7;
        } else if (period === 'monthly') {
            startDate = now - 30 * 24 * 60 * 60 * 1000;
            totalDaysInPeriod = 30;
        } else if (period === 'thisYear') {
            const startOfYear = new Date(new Date().getFullYear(), 0, 1);
            startDate = startOfYear.getTime();
            // Calculate days passed in current year
            totalDaysInPeriod = Math.ceil((now - startDate) / (24 * 60 * 60 * 1000));
        } else {
            // allTime
            startDate = 0;
            // Will be calculated from first play
        }

        // Fetch current period history
        const history = await databaseService.getHistory(startDate);

        // Calculate total days for allTime if needed
        if (period === 'allTime' && history.length > 0) {
            const firstPlay = history.reduce((min, p) => (p.timestamp < min ? p.timestamp : min), history[0].timestamp);
            totalDaysInPeriod = Math.ceil((now - firstPlay) / (24 * 60 * 60 * 1000));
            if (totalDaysInPeriod < 1) totalDaysInPeriod = 1;
        } else if (period === 'allTime') {
            totalDaysInPeriod = 1;
        }

        // Fetch previous period history for comparison
        let prevHistory: ListeningHistoryDocument[] = [];
        const prevPeriod = this.getPreviousPeriod(period, startDate);
        if (prevPeriod) {
            const rawPrev = await databaseService.getHistory(prevPeriod.start);
            prevHistory = rawPrev.filter((h) => h.timestamp < prevPeriod.end);
        }

        // Fetch all tracks for metadata
        const allTracks = await databaseService.getAllTracks();
        const trackMap = new Map<string, TrackDocument>();
        for (const t of allTracks) {
            trackMap.set(t._id, t);
        }

        // --- Helper to calculate stats for a dataset ---
        const calculateMetrics = (data: ListeningHistoryDocument[]) => {
            let totalTracksPlayed = 0;
            let totalListeningTimeSeconds = 0;
            const trackStats = new Map<string, { playCount: number }>();
            const artistStats = new Map<string, { playCount: number; url: string; duration: number }>();
            const playsPerHour: number[] = new Array(24).fill(0);

            // For Max Tracks/Day
            const tracksPerDay = new Map<string, Set<string>>();
            const durationPerDay = new Map<string, number>();

            // For Calendar
            const calendarData: { [date: string]: { count: number; artworks: Set<string> } } = {};

            // For Max Repeats (New Logic: Allow gap of up to 2 tracks)
            // Active Obsessions: Map<TrackID, {count, lastSeenIndex}>
            const activeObsessions = new Map<string, { count: number; lastSeenIndex: number }>();
            let maxRepeats = 0;
            let maxRepeatsTrackId: string | null = null;

            // Helper for high-res artwork
            const getHighResArtwork = (url?: string) => {
                if (!url) return '';
                return url.replace('large', 't500x500');
            };

            // Sort data by timestamp for sequence analysis
            const sortedData = [...data].sort((a, b) => a.timestamp - b.timestamp);

            for (let i = 0; i < sortedData.length; i++) {
                const entry = sortedData[i];
                const date = new Date(entry.timestamp);
                const dayKey = date.toISOString().split('T')[0];

                // Aggregate Play Counts
                if (entry.is_play_count === 1) {
                    totalTracksPlayed++;

                    // Track Play Count
                    if (!trackStats.has(entry.track_id)) {
                        trackStats.set(entry.track_id, { playCount: 0 });
                    }
                    trackStats.get(entry.track_id)!.playCount++;

                    // Artist Play Count
                    const track = trackMap.get(entry.track_id);
                    if (track) {
                        if (!artistStats.has(track.artist)) {
                            const urlParts = track._id.split('/');
                            const artistUrl = urlParts.slice(0, 4).join('/');
                            artistStats.set(track.artist, { playCount: 0, url: artistUrl, duration: 0 });
                        }
                        artistStats.get(track.artist)!.playCount++;
                    }

                    // Plays per hour
                    playsPerHour[date.getHours()]++;

                    // Max Tracks per Day & Calendar
                    if (!tracksPerDay.has(dayKey)) {
                        tracksPerDay.set(dayKey, new Set());
                    }
                    tracksPerDay.get(dayKey)!.add(entry.track_id);

                    if (!calendarData[dayKey]) {
                        calendarData[dayKey] = { count: 0, artworks: new Set() };
                    }
                    calendarData[dayKey].count++;
                    if (track && track.artwork) {
                        calendarData[dayKey].artworks.add(getHighResArtwork(track.artwork));
                    }

                    // Max Repeats Logic
                    // Update existing obsessions
                    for (const [trackId, obs] of activeObsessions.entries()) {
                        if (trackId === entry.track_id) {
                            obs.count++;
                            obs.lastSeenIndex = i;
                        } else {
                            // Check gap
                            if (i - obs.lastSeenIndex > 2) {
                                // Obsession broken
                                if (obs.count > maxRepeats) {
                                    maxRepeats = obs.count;
                                    maxRepeatsTrackId = trackId;
                                }
                                activeObsessions.delete(trackId);
                            }
                        }
                    }
                    // Start new obsession if not exists
                    if (!activeObsessions.has(entry.track_id)) {
                        activeObsessions.set(entry.track_id, { count: 1, lastSeenIndex: i });
                    }
                }

                // Aggregate Time
                totalListeningTimeSeconds += entry.listened_seconds;

                // Duration per Day
                const currentDayDuration = durationPerDay.get(dayKey) || 0;
                durationPerDay.set(dayKey, currentDayDuration + entry.listened_seconds);

                // Artist Duration
                const track = trackMap.get(entry.track_id);
                if (track && artistStats.has(track.artist)) {
                    artistStats.get(track.artist)!.duration += entry.listened_seconds;
                }
            }

            // Final check for repeats
            for (const [trackId, obs] of activeObsessions.entries()) {
                if (obs.count > maxRepeats) {
                    maxRepeats = obs.count;
                    maxRepeatsTrackId = trackId;
                }
            }

            return {
                totalTracksPlayed,
                totalListeningTimeSeconds,
                trackStats,
                artistStats,
                playsPerHour,
                tracksPerDay,
                durationPerDay,
                maxRepeats,
                maxRepeatsTrackId,
                calendarData,
            };
        };

        const currentStats = calculateMetrics(history);
        const prevStats = calculateMetrics(prevHistory);

        // --- Process Current Stats ---

        // 1. Top Tracks (Fetch Top 50)
        const topTracks = Array.from(currentStats.trackStats.entries())
            .map(([id, stats]) => {
                const track = trackMap.get(id);
                // Calculate change
                const prevCount = prevStats.trackStats.get(id)?.playCount || 0;
                let change = 0;
                if (prevCount > 0) {
                    change = ((stats.playCount - prevCount) / prevCount) * 100;
                } else if (stats.playCount > 0) {
                    change = 100; // New entry
                }

                return {
                    title: track ? track.title : 'Unknown Title',
                    artist: track ? track.artist : 'Unknown Artist',
                    playCount: stats.playCount,
                    url: id,
                    artwork: track ? track.artwork?.replace('large', 't500x500') : '',
                    change: parseFloat(change.toFixed(2)),
                };
            })
            .sort((a, b) => b.playCount - a.playCount)
            .slice(0, 50);

        const mostPlayedTrack = topTracks.length > 0 ? topTracks[0] : null;
        // Add artist URL to mostPlayedTrack
        const topTracksWithArtistUrl = topTracks.map((t) => {
            const urlParts = t.url.split('/');
            const artistUrl = urlParts.slice(0, 4).join('/');
            return { ...t, artistUrl };
        });

        // 2. Top Artists (Fetch Top 50)
        let topArtists = Array.from(currentStats.artistStats.entries())
            .map(([name, stats]) => {
                const prevArtistStats = prevStats.artistStats.get(name);
                const prevCount = prevArtistStats?.playCount || 0;
                let change = 0;
                if (prevCount > 0) {
                    change = ((stats.playCount - prevCount) / prevCount) * 100;
                } else if (stats.playCount > 0) {
                    change = 100;
                }

                // Find an artwork for the artist
                let artwork = '';
                for (const t of allTracks) {
                    if (t.artist === name && t.artwork) {
                        artwork = t.artwork.replace('large', 't500x500');
                        break;
                    }
                }

                return {
                    name: name,
                    playCount: stats.playCount,
                    url: stats.url,
                    duration: stats.duration,
                    artwork,
                    change: parseFloat(change.toFixed(2)),
                };
            })
            .sort((a, b) => b.playCount - a.playCount)
            .slice(0, 50);

        // 3. Variety Score
        const uniqueTracks = currentStats.trackStats.size;
        const varietyScore =
            currentStats.totalTracksPlayed > 0
                ? parseFloat(((uniqueTracks / currentStats.totalTracksPlayed) * 100).toFixed(1))
                : 0;

        // 4. Obsession Rate
        const topTrackPlays = mostPlayedTrack ? mostPlayedTrack.playCount : 0;
        const obsessionRate =
            currentStats.totalTracksPlayed > 0
                ? parseFloat(((topTrackPlays / currentStats.totalTracksPlayed) * 100).toFixed(1))
                : 0;

        // 5. Max Tracks in a Day
        let maxTracksCount = 0;
        let maxTracksDate = '';
        let maxTracksDuration = 0;
        for (const [date, set] of currentStats.tracksPerDay) {
            if (set.size > maxTracksCount) {
                maxTracksCount = set.size;
                maxTracksDate = date;
                maxTracksDuration = currentStats.durationPerDay.get(date) || 0;
            }
        }

        // 6. Max Repeats
        const maxRepeatsTrack = currentStats.maxRepeatsTrackId ? trackMap.get(currentStats.maxRepeatsTrackId) : null;
        let maxRepeatsArtistUrl = '';
        if (maxRepeatsTrack) {
            const urlParts = maxRepeatsTrack._id.split('/');
            maxRepeatsArtistUrl = urlParts.slice(0, 4).join('/');
        }

        // 7. Time Calculation
        const hours = Math.floor(currentStats.totalListeningTimeSeconds / 3600);
        const minutes = Math.floor((currentStats.totalListeningTimeSeconds % 3600) / 60);
        const seconds = Math.floor(currentStats.totalListeningTimeSeconds % 60);

        // Time Change
        let timeChangeStr = '';
        if (prevStats.totalListeningTimeSeconds > 0) {
            const diff = currentStats.totalListeningTimeSeconds - prevStats.totalListeningTimeSeconds;
            const percent = (diff / prevStats.totalListeningTimeSeconds) * 100;
            timeChangeStr = (diff > 0 ? '+' : '') + percent.toFixed(1) + '%';
        }

        // 8. New Metrics
        // Average Track Length
        const averageTrackLength =
            currentStats.totalTracksPlayed > 0
                ? Math.round(currentStats.totalListeningTimeSeconds / currentStats.totalTracksPlayed)
                : 0;

        // Consistency Score (Active Days / Total Days)
        const activeDays = currentStats.durationPerDay.size;
        const consistencyScore =
            totalDaysInPeriod > 0 ? parseFloat(((activeDays / totalDaysInPeriod) * 100).toFixed(2)) : 0;

        // Average Daily Listening (Total Time / Total Days)
        const averageDailyListening =
            totalDaysInPeriod > 0 ? Math.round(currentStats.totalListeningTimeSeconds / totalDaysInPeriod) : 0;

        // Tracks played > 5 times in "All Time" (excluding current period if possible, but let's just check global stats)
        // AND played 0 times in current period.
        // To do this accurately, we need "All Time" stats.
        // Let's assume "All Time" means "Everything before startDate".
        const rediscoveries: Array<{
            title: string;
            artist: string;
            playCount: number;
            url: string;
            lastPlayed: number;
        }> = [];

        if (period !== 'allTime') {
            // Fetch history BEFORE current period
            const oldHistory = await databaseService.history.find({ timestamp: { $lt: startDate } });
            const oldTrackStats = new Map<string, { playCount: number; lastPlayed: number }>();

            for (const entry of oldHistory) {
                if (entry.is_play_count === 1) {
                    if (!oldTrackStats.has(entry.track_id)) {
                        oldTrackStats.set(entry.track_id, { playCount: 0, lastPlayed: 0 });
                    }
                    const stat = oldTrackStats.get(entry.track_id)!;
                    stat.playCount++;
                    if (entry.timestamp > stat.lastPlayed) stat.lastPlayed = entry.timestamp;
                }
            }

            // Find candidates: High play count in old history, 0 in current
            for (const [id, stats] of oldTrackStats) {
                if (stats.playCount >= 5 && !currentStats.trackStats.has(id)) {
                    const track = trackMap.get(id);
                    if (track) {
                        rediscoveries.push({
                            title: track.title,
                            artist: track.artist,
                            playCount: stats.playCount, // Historical play count
                            url: id,
                            lastPlayed: stats.lastPlayed,
                        });
                    }
                }
            }
            // Sort by historical play count
            rediscoveries.sort((a, b) => b.playCount - a.playCount);
        }

        // Total Tracks Change
        let totalTracksChange = 0;
        if (prevStats.totalTracksPlayed > 0) {
            totalTracksChange =
                ((currentStats.totalTracksPlayed - prevStats.totalTracksPlayed) / prevStats.totalTracksPlayed) * 100;
        }

        // Process Calendar Data for JSON serialization (convert Set to Array)
        const finalCalendar: { [date: string]: { count: number; artworks: string[] } } = {};
        for (const [date, data] of Object.entries(currentStats.calendarData)) {
            finalCalendar[date] = {
                count: data.count,
                artworks: Array.from(data.artworks).slice(0, 100), // Limit to 100 artworks per day
            };
        }

        return {
            totalTracksPlayed: currentStats.totalTracksPlayed,
            totalTracksPlayedChange: parseFloat(totalTracksChange.toFixed(2)),
            mostPlayedTrack: mostPlayedTrack
                ? { ...mostPlayedTrack, artistUrl: topTracksWithArtistUrl[0].artistUrl }
                : null,
            totalListeningTime: { hours, minutes, seconds, change: timeChangeStr },
            topTracks: topTracksWithArtistUrl,
            topArtists,
            playsPerHour: currentStats.playsPerHour,
            maxTracksInDay: { count: maxTracksCount, date: maxTracksDate, duration: maxTracksDuration },
            maxRepeats: {
                count: currentStats.maxRepeats,
                track: maxRepeatsTrack
                    ? {
                          title: maxRepeatsTrack.title,
                          artist: maxRepeatsTrack.artist,
                          url: maxRepeatsTrack._id,
                          artistUrl: maxRepeatsArtistUrl,
                      }
                    : null,
            },
            varietyScore,
            obsessionRate,
            averageTrackLength,
            averageDailyListening,
            consistencyScore,
            rediscoveries: rediscoveries.slice(0, 5), // Top 5 rediscoveries
            calendar: finalCalendar,
        };
    }
}

export const listeningStatsService = new ListeningStatsService();
