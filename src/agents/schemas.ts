import { z } from "zod";

export const dispatchAgentQuerySchema = z.object({
  room: z.string().optional(),
  userName: z.string().optional(),
  identity: z.string().optional(),
  agentName: z.string().optional(),
  userContext: z.string().optional(),
});

export type DispatchAgentQuery = z.infer<typeof dispatchAgentQuerySchema>;
