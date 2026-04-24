declare module 'firebase-tools';
declare module 'pdf-parse';
declare module 'promptpay-qr';

interface VectorizeIndex {
    upsert(vectors: any[]): Promise<void>;
    query(values: number[], options: any): Promise<any>;
    getByIds(ids: string[]): Promise<any[]>;
}
