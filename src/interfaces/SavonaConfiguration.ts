export interface SavonaConfiguration {
    server?: {
        port?: number;
    },
    cameras: { [key: string]: {
        host: string;
        username: string;
        password: string;
    }}
}
