// src/services/listeningStatsService.ts

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

    public getStats(period: 'weekly' | 'monthly'): {
        totalTracksPlayed: number;
        mostPlayedTrack: { title: string; artist: string; playCount: number } | null;
        totalListeningTime: { hours: number; minutes: number; seconds: number };
    } {
        const now = Date.now();
        let startDate: number;

        if (period === 'weekly') {
            startDate = now - (7 * 24 * 60 * 60 * 1000); // 7 days ago
        } else { // monthly
            startDate = now - (30 * 24 * 60 * 60 * 1000); // 30 days ago
        }

        const filteredEntries = this.data.entries.filter(entry => entry.timestamp >= startDate);

        const totalTracksPlayed = filteredEntries.length;

        // Calculate most played track
        const trackPlayCounts = new Map<string, { title: string; artist: string; count: number }>();
        let totalListeningTimeSeconds = 0;

        for (const entry of filteredEntries) {
            const trackId = entry.track.id;
            if (trackPlayCounts.has(trackId)) {
                trackPlayCounts.get(trackId)!.count++;
            } else {
                trackPlayCounts.set(trackId, {
                    title: entry.track.title,
                    artist: entry.track.artist,
                    count: 1,
                });
            }
            totalListeningTimeSeconds += entry.track.duration;
        }

        let mostPlayedTrack: { title: string; artist: string; playCount: number } | null = null;
        let maxPlayCount = 0;

        for (const [, trackData] of trackPlayCounts) {
            if (trackData.count > maxPlayCount) {
                maxPlayCount = trackData.count;
                mostPlayedTrack = {
                    title: trackData.title,
                    artist: trackData.artist,
                    playCount: trackData.count,
                };
            }
        }

        const hours = Math.floor(totalListeningTimeSeconds / 3600);
        const minutes = Math.floor((totalListeningTimeSeconds % 3600) / 60);
        const seconds = totalListeningTimeSeconds % 60;

        return {
            totalTracksPlayed,
            mostPlayedTrack,
            totalListeningTime: { hours, minutes, seconds },
        };
    }
}

export const listeningStatsService = new ListeningStatsService();
