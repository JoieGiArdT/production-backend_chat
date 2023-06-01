import { Request, Response } from 'express'
import { taskService } from '../services/task.service'
import whatsappService from '../services/whatsapp.service'
import bot from '../utils/bot.util'
export default class WhatsappController {
  receivedMessageWhatsapp ({ body }: Request, res: Response): void {
    try {
      if (body?.entry[0]?.changes[0]?.value?.messages !== undefined) {
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
            if (responseGetTaskById[indexTasks] === undefined || responseGetTaskById[indexTasks].data().status === 'CLOSE') {
              bot.processNewTask(body, res).then(() => {
                console.log('nuevo')
              }).catch(() => {})
            } else {
              let isMenu = false
              let type = ''
              const title = body.messages[0]?.interactive?.button_reply?.title
              if (title === 'Volver al menú' || title === 'Volver al inicio') {
                isMenu = true
                type = title
              }
              if (isMenu) {
                switch (type) {
                  case 'Volver al menú':{
                    void taskService.updateTask(responseGetTaskById[indexTasks].id, {
                      status: 'menu'
                    })
                    void whatsappService.sendMessageWhatsapp(
                      {
                        bodyText: 'Por favor, selecciona el tipo de asistencia que necesitas de las opciones a continuación:🔍',
                        buttons: {
                          Consulta: 'Consultas',
                          Documento: 'Documentación',
                          Menu: 'Volver al inicio'
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
                  case 'Volver al inicio':{
                    void taskService.updateTask(responseGetTaskById[indexTasks].id, {
                      sequence_task: [],
                      status: 'phone'
                    })
                    void whatsappService.sendMessageWhatsapp(
                      {
                        text: 'Por favor, introduce tu número de identificación para poder ayudarte mejor. ¡Estamos listos para atenderte! 💪👍',
                        options: {
                          preview_url: false
                        }
                      },
                      'text',
                      String(process.env.ID_NUMBER),
                      String(process.env.WP_TOKEN),
                      body.messages[0].from
                    )
                    break
                  }
                  case 'Finalizar':{
                    void taskService.updateTask(responseGetTaskById[indexTasks].id, {
                      sequence_task: [],
                      status: 'encuesta'
                    })
                    void whatsappService.sendMessageWhatsapp(
                      {
                        buttonName: 'Inmuebles',
                        bodyText: '🤖 ¡Gracias por tu tiempo y por llenar nuestra encuesta! Valoramos tus comentarios. Si tienes alguna otra pregunta o necesitas ayuda en el futuro, no dudes en contactarnos. ¡Que tengas un excelente día! 😊',
                        sections: [
                          {
                            id: '1',
                            title: '1',
                            description: ''
                          },
                          {
                            id: '2',
                            title: '2',
                            description: ''
                          },
                          {
                            id: '3',
                            title: '3',
                            description: ''
                          },
                          {
                            id: '4',
                            title: '4',
                            description: ''
                          },
                          {
                            id: '5',
                            title: '5',
                            description: ''
                          }
                        ],
                        options: {
                          // Opciones adicionales, si es necesario
                        }
                      },
                      'list',
                      String(process.env.ID_NUMBER),
                      String(process.env.WP_TOKEN),
                      body.messages[0].from
                    )
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
      } else {
        res.status(200).send('RECEIVED')
      }
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
