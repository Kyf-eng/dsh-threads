import z from '@deepseek-ai/schemastery'

export const Config = z.object({
  maxRunning: z.natural().min(1).default(3)
    .description('How many threads one main conversation may run at once.'),
  maxAutoWakes: z.natural().default(5)
    .description('Consecutive automatic wake-ups of the main conversation before reports wait for the user; 0 never wakes it automatically.'),
  noteMaxChars: z.natural().min(80).default(400)
    .description('Longest report delivered back to the main conversation.'),
  summaryMaxChars: z.natural().min(40).default(300)
    .description('Longest summary a thread may submit through thread_report.'),
  proposalTtlDays: z.natural().min(1).default(7)
    .description('Days before an unstarted thread proposal expires.'),
  maxProposalsPerTurn: z.natural().min(1).default(3)
    .description('Most thread proposals the main conversation may make in one turn.'),
  reportReminder: z.boolean().default(true)
    .description('When a task round ends without thread_report, ask the thread once to report before falling back to its last reply.'),
  inheritPermissionPreset: z.boolean().default(true)
    .description('Give each thread the main conversation\'s current permission preset instead of the user default.'),
})

export type Config = ReturnType<typeof Config>
