export interface Task {
  external_id: string
  type_client: string
  timestamp: string | null
  status: string // PENDING | DONE
  sequence_task: string[]
}

export class SchemaTask {
  task!: Task
  constructor (
    externalId: string,
    typeClient: string,
    sequenceTask: string[]
  ) {
    this.task = {
      external_id: externalId,
      type_client: typeClient,
      timestamp: null,
      status: 'phone',
      sequence_task: sequenceTask
    }
  }
}
