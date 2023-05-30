export interface Task {
  external_id: string
  type_task: string
  timestamp: string | null
  status: string // PENDING | DONE
  sequence_task: string[]
}

export class SchemaTask {
  task!: Task
  constructor (
    externalId: string,
    typeTask: string,
    sequenceTask: string[]
  ) {
    this.task = {
      external_id: externalId,
      type_task: typeTask,
      timestamp: null,
      status: 'phone',
      sequence_task: sequenceTask
    }
  }
}
