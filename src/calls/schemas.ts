import { z } from "zod";

export const createCallSchema = z.object({
  id: z.string().min(1, "id is required"),
  user_id: z.string().min(1, "user_id is required"),
  agent_name: z.string().min(1, "agent_name is required"),
  started_at: z.string().min(1, "started_at is required"),
  ended_at: z.string().min(1, "ended_at is required"),
  messages_json: z.string().min(1, "messages_json is required"),
  user_location: z.string().optional().nullable(),
  room_id: z.string().optional().nullable(),
});

export const addMemorySchema = z.object({
  room_id: z.string().min(1, "room_id is required"),
  user_id: z.string().min(1, "user_id is required"),
  embedding_id: z.number().min(1, "embedding_id is required"),
  memory: z.string().min(1, "memory is required"),
  memory_type: z.enum(['summary', 'fact'])
});

export const paginationQuerySchema = z.object({
  page: z.string().optional().default("1").transform((val) => parseInt(val)),
  limit: z.string().optional().default("10").transform((val) => parseInt(val)),
}).refine(
  (data) => data.page >= 1,
  { message: "Page must be >= 1" }
).refine(
  (data) => data.limit >= 1 && data.limit <= 100,
  { message: "Limit must be between 1 and 100" }
);

export type CreateCallInput = z.infer<typeof createCallSchema>;
export type AddMemoryInput = z.infer<typeof addMemorySchema>;
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
