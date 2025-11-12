import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

interface TrackInfo {
    id: string;
    title: string;
    artist: string;
    duration: number; // in seconds
}

interface ListeningEntry {
    track: TrackInfo;
    timestamp: number; // Unix timestamp
}

interface ListeningStatsData {
    entries: ListeningEntry[];
}

interface StatsResult {
    totalTracksPlayed: number;
    mostPlayedTrack: { title: string; artist: string; playCount: number; url: string } | null;
    totalListeningTime: { hours: number; minutes: number; seconds: number };
    topTracks: Array<{ title: string; artist: string; playCount: number; url: string }>;
    topArtists: Array<{ name: string; playCount: number }>;
    playsPerHour: number[]; // Array of 24 numbers, representing plays for each hour
}

class ListeningStatsService {
    private dataFilePath: string;
    private data: ListeningStatsData = { entries: [] };

    constructor() {
        const userDataPath = app.getPath('userData');
        this.dataFilePath = path.join(userDataPath, 'listening-stats.json');
        this.loadData();
    }

    private loadData(): void {
        try {
            if (fs.existsSync(this.dataFilePath)) {
                const rawData = fs.readFileSync(this.dataFilePath, 'utf-8');
                this.data = JSON.parse(rawData);
            }
        } catch (error) {
            console.error('Failed to load listening stats data:', error);
            this.data = { entries: [] }; // Reset data on error
        }
    }

    private saveData(): void {
        try {
            fs.writeFileSync(this.dataFilePath, JSON.stringify(this.data, null, 2), 'utf-8');
        } catch (error) {
            console.error('Failed to save listening stats data:', error);
        }
    }

    public addListeningEntry(trackInfo: TrackInfo): void {
        const newEntry: ListeningEntry = {
            track: trackInfo,
            timestamp: Date.now(),
        };
        this.data.entries.push(newEntry);
        this.saveData();
        console.log('Added new listening entry:', newEntry);
    }

    public getStats(period: 'weekly' | 'monthly' | 'thisYear' | 'allTime'): StatsResult {
        const now = Date.now();
        let startDate: number;

        if (period === 'weekly') {
            startDate = now - (7 * 24 * 60 * 60 * 1000);
        } else if (period === 'monthly') {
            startDate = now - (30 * 24 * 60 * 60 * 1000);
        } else if (period === 'thisYear') {
            const startOfYear = new Date(new Date().getFullYear(), 0, 1);
            startDate = startOfYear.getTime();
        } else { // allTime
            startDate = 0; // Unix epoch
        }

        const filteredEntries = this.data.entries.filter(entry => entry.timestamp >= startDate);

        const totalTracksPlayed = filteredEntries.length;

        const trackPlayCounts = new Map<string, { title: string; artist: string; count: number; url: string }>();
        const artistPlayCounts = new Map<string, { name: string; count: number }>();
        const playsPerHour: number[] = new Array(24).fill(0);
        let totalListeningTimeSeconds = 0;

        for (const entry of filteredEntries) {
            const trackId = entry.track.id;
            const artistName = entry.track.artist;

            // Track play counts
            if (trackPlayCounts.has(trackId)) {
                trackPlayCounts.get(trackId)!.count++;
            } else {
                trackPlayCounts.set(trackId, {
                    title: entry.track.title,
                    artist: artistName,
                    count: 1,
                    url: entry.track.id,
                });
            }

            // Artist play counts
            if (artistPlayCounts.has(artistName)) {
                artistPlayCounts.get(artistName)!.count++;
            } else {
                artistPlayCounts.set(artistName, {
                    name: artistName,
                    count: 1,
                });
            }

            // Plays per hour
            const entryDate = new Date(entry.timestamp);
            const hour = entryDate.getHours();
            playsPerHour[hour]++;

            totalListeningTimeSeconds += entry.track.duration;
        }

        // Most played track
        let mostPlayedTrack: { title: string; artist: string; playCount: number; url: string } | null = null;
        let maxTrackPlayCount = 0;
        for (const [, trackData] of trackPlayCounts) {
            if (trackData.count > maxTrackPlayCount) {
                maxTrackPlayCount = trackData.count;
                mostPlayedTrack = {
                    title: trackData.title,
                    artist: trackData.artist,
                    playCount: trackData.count, // Corrected property name
                    url: trackData.url,
                };
            }
        }

        // Top 5 tracks
        const topTracks = Array.from(trackPlayCounts.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
            .map(track => ({
                title: track.title,
                artist: track.artist,
                playCount: track.count, // Corrected property name
                url: track.url,
            }));

        // Top 5 artists
        const topArtists = Array.from(artistPlayCounts.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
            .map(artist => ({
                name: artist.name,
                playCount: artist.count, // Corrected property name
            }));

        const hours = Math.floor(totalListeningTimeSeconds / 3600);
        const minutes = Math.floor((totalListeningTimeSeconds % 3600) / 60);
        const seconds = totalListeningTimeSeconds % 60;

        return {
            totalTracksPlayed,
            mostPlayedTrack,
            totalListeningTime: { hours, minutes, seconds },
            topTracks,
            topArtists,
            playsPerHour,
        };
    }
}

export const listeningStatsService = new ListeningStatsService();
