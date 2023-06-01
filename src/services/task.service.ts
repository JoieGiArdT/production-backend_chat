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
import { chatGPTService } from './chatGPT.service'

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
const variable = async (): Promise<void> => {
  const prompt = 'Necesito que respondas a la siguiente como si fueras un agente de servicio al cliente, tu respuesta será reflejada en el chat de un bot, por lo que las respuestas que generes no pueden ser largas. La consulta que hace el cliente es la siguiente:' +
  String('holi')
  console.log(prompt)
  const response = await chatGPTService.requestChatGPT(prompt)
  console.log(response)
}

void variable()

const taskService = new TaskService()
export { taskService, SchemaTask }
