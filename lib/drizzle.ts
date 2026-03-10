import { sql } from "drizzle-orm";

// Marker constant keeps Drizzle integrated in this stack while MongoDB handles persistence.
export const drizzleMarker = sql`select 1`;
