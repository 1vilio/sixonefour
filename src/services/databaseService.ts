import { app } from 'electron';
import * as path from 'path';
import Datastore from 'nedb-promises';

export interface TrackDocument {
    _id: string; // Use URL as ID
    title: string;
    artist: string;
    duration: number;
    artwork: string;
    created_at: number;
}

export interface ListeningHistoryDocument {
    track_id: string;
    timestamp: number;
    listened_seconds: number;
    is_play_count: number; // 0 or 1
}

class DatabaseService {
    public tracks!: Datastore<TrackDocument>;
    public history!: Datastore<ListeningHistoryDocument>;

    constructor() {
        // Initialization moved to initialize()
    }

    public initialize(): void {
        const userDataPath = app.getPath('userData');

        this.tracks = Datastore.create({
            filename: path.join(userDataPath, 'tracks.db'),
            autoload: true,
            timestampData: true,
        });

        this.history = Datastore.create({
            filename: path.join(userDataPath, 'listening_history.db'),
            autoload: true,
            timestampData: true,
        });

        // Ensure indexes for performance
        this.history.ensureIndex({ fieldName: 'timestamp' });
        this.history.ensureIndex({ fieldName: 'track_id' });

        console.log('[Database] Initialized NeDB stores at', userDataPath);
    }

    /**
     * Saves or updates track metadata.
     */
    public async saveTrack(track: TrackDocument): Promise<void> {
        // upsert: true means insert if not exists, update if exists
        await this.tracks.update({ _id: track._id }, { $set: track }, { upsert: true });
    }

    /**
     * Logs a listening session.
     */
    public async logHistory(entry: ListeningHistoryDocument): Promise<void> {
        await this.history.insert(entry);
    }

    /**
     * Get aggregated stats for a specific period.
     * Since NeDB doesn't have complex aggregation pipelines like MongoDB,
     * we'll do some processing in JS, but filter by date at the DB level.
     */
    public async getHistory(startDate: number): Promise<ListeningHistoryDocument[]> {
        return this.history.find({ timestamp: { $gte: startDate } });
    }

    public async getAllTracks(): Promise<TrackDocument[]> {
        return this.tracks.find({});
    }

    public async getTrack(id: string): Promise<TrackDocument | null> {
        return this.tracks.findOne({ _id: id });
    }
}

export const databaseService = new DatabaseService();
