import { Task, SchemaTask } from '../types/task.types'
import {
  collection,
  getDocs,
  addDoc,
  query,
  where,
  DocumentData,
  QueryDocumentSnapshot,
  serverTimestamp,
  updateDoc,
  doc
} from 'firebase/firestore'
import FireStore from '../config/firebase.database'

class TaskService {
  async createTask (
    task: Task
  ): Promise<void> {
    await addDoc(
      collection(FireStore.dataBase, 'tasks')
      ,
      Object.defineProperties(task, {
        timestamp: {
          value: serverTimestamp()
        }
      }
      )
    )
  }

  async updateTask (
    id: string,
    parameters: object
  ): Promise<void> {
    const taskRef = doc(FireStore.dataBase, 'tasks', id)
    return await updateDoc(taskRef, parameters)
  }

  async getTaskById (
    id: string
  ): Promise<Array<QueryDocumentSnapshot<DocumentData>>> {
    const _query = query(
      collection(FireStore.dataBase, 'tasks')
      ,
      where('external_id', '==', id)
    )
    const querySnapshot = await getDocs(_query)
    const resultMessages: Array<QueryDocumentSnapshot<DocumentData>> = []
    querySnapshot.forEach((doc) => {
      resultMessages.push(doc)
    })
    return resultMessages
  }
}

const taskService = new TaskService()
export { taskService, SchemaTask }
