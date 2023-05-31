import { Request, Response } from 'express'
import { taskService } from '../services/task.service'
import whatsappService from '../services/whatsapp.service'
import bot from '../utils/bot.util'
export default class WhatsappController {
  receivedMessageWhatsapp ({ body }: Request, res: Response): void {
    try {
      body = body.entry[0].changes[0].value
      taskService.getTaskById(body.contacts[0].wa_id)
        .then((responseGetTaskById) => {
          let indexTasks = 0
          let maxSeconds = 0
          let index = 0
          responseGetTaskById.forEach((task) => {
            if (task.data().timestamp.seconds > maxSeconds) {
              maxSeconds = task.data().timestamp.seconds
              indexTasks = index
            }
            index++
          })
          if ((responseGetTaskById[indexTasks] === undefined || responseGetTaskById[indexTasks].data().status === 'CLOSE') ||
          (responseGetTaskById[indexTasks].data().sequence_task).length as number === 0) {
            bot.processNewTask(body, res).then(() => {
              console.log('listo')
            }).catch(() => {})
          } else {
            let isMenu = false
            let type = ''
            Object.entries(body.messages[0]).forEach(([key, _value]) => {
              if (key === 'button') {
                if (body.messages[0].button.text === 'Volver al menú' || body.messages[0].button.text === 'Ingresar identificación') {
                  isMenu = true
                  type = body.messages[0].button.text
                }
              }
            })
            if (isMenu) {
              switch (type) {
                case 'Volver al menú':{
                  void taskService.updateTask(responseGetTaskById[indexTasks].id, {
                    status: 'menu'
                  })
                  void whatsappService.sendMessageWhatsapp(
                    {
                      bodyText: 'Por favor, selecciona el tipo de asistencia que necesitas de las opciones a continuación:',
                      buttons: {
                        Consulta: 'Consultas',
                        Documento: 'Documentación'
                      },
                      options: {
                        // Opciones adicionales, si es necesario
                      }
                    },
                    'button',
                    String(process.env.ID_NUMBER),
                    String(process.env.WP_TOKEN),
                    body.messages[0].from)
                  break
                }
                case 'Ingresar identificación':{
                  const array = responseGetTaskById[indexTasks].data().sequence_task
                  const arreglo = []
                  arreglo.push(array[0])
                  void taskService.updateTask(responseGetTaskById[indexTasks].id, {
                    sequence_task: arreglo,
                    status: 'pin'
                  })
                  break
                }
              }
            } else {
              void bot.processExistingTask(body, responseGetTaskById[indexTasks], res)
            }
          }
          res.status(200).send('RECEIVED')
        }).catch((error) => {
          console.error(error)
          res.status(400).send('NOT_RECEIVED')
        })
    } catch (error) {
      res.status(400).send('NOT_RECEIVED')
    }
  }

  verifyToken ({ query }: Request, res: Response): void {
    try {
      const accessToken = String(process.env.TOKEN)
      if (query['hub.challenge'] != null &&
        String(query['hub.verify_token']) != null &&
        String(query['hub.verify_token']) === accessToken) {
        res.send(query['hub.challenge'])
      } else {
        res.status(400).send('VERIFICATION_FAILED')
      }
    } catch (error) {
      res.status(400).send()
    }
  }
}
