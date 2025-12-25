declare module 'node-id3' {
    export interface Tags {
        title?: string;
        artist?: string;
        album?: string;
        APIC?:
            | string
            | Buffer
            | {
                  mime: string;
                  type: {
                      id: number;
                      name: string;
                  };
                  description: string;
                  imageBuffer: Buffer;
              };
        image?:
            | string
            | Buffer
            | {
                  mime: string;
                  type: {
                      id: number;
                      name: string;
                  };
                  description: string;
                  imageBuffer: Buffer;
              };
        userDefinedText?: {
            description: string;
            value: string;
        }[];
        [key: string]: any;
    }

    export function write(tags: Tags, filebuffer: Buffer): Buffer;
    export function write(tags: Tags, filepath: string): boolean;
    export function write(tags: Tags, filepath: string, callback: (err: Error | null) => void): void;

    export function update(tags: Tags, filepath: string): boolean;
    export function update(tags: Tags, filepath: string, callback: (err: Error | null) => void): void;

    export function create(tags: Tags): Buffer;
}
