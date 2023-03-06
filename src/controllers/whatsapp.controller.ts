import { Request, Response } from 'express'
import { DocumentData, DocumentReference } from 'firebase/firestore'
import { conversationService, SchemaConversation } from '../services/conversation.service'
import { messageService, SchemaMessage } from '../services/message.service'
import { ninoxService } from '../services/ninox.service'
import { taskService, SchemaTask } from '../services/task.service'
import whatsappService from '../services/whatsapp.service'
import { botUtil } from '../utils/bot.util'
import FormData from 'form-data'
import fs from 'fs'
import path from 'path'
import { apiErrorHandler } from '../handlers/error.handler'

export default class WhatsappController {
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

  receivedMessageWhatsapp (req: Request, res: Response): void {
    try {
      const body = req.body.entry[0].changes[0].value
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
          const responseGetParameterForAnswerTask = botUtil.getParameterForAnswerTask({
            answer: (responseGetTaskById[indexTasks] === undefined || responseGetTaskById[indexTasks].data().status === 'CLOSE'
              ? 1
              : (responseGetTaskById[indexTasks].data().sequence_task).length as number + 1
            ),
            response: body.messages[0]
          },
          (body.messages[0].type === 'text' && (responseGetTaskById[indexTasks] === undefined || responseGetTaskById[indexTasks].data().status === 'CLOSE')
            ? body.messages[0][body.messages[0].type].body
            : (responseGetTaskById[indexTasks] === undefined || responseGetTaskById[indexTasks].data().status === 'CLOSE'
                ? 'No task'
                : responseGetTaskById[indexTasks].data().type_task)
          ))
          if (Object.entries(responseGetParameterForAnswerTask).length === 0 &&
            (responseGetTaskById[indexTasks] === undefined || responseGetTaskById[indexTasks].data().status === 'CLOSE')) {
            res.send('ES UNA CONVERSACION')
          } else {
            new Promise((resolve, reject) => {
              if (responseGetTaskById[indexTasks] === undefined || responseGetTaskById[indexTasks].data().status === 'CLOSE') {
                if (Object.entries(responseGetParameterForAnswerTask).length !== 0) {
                  ninoxService.searchField(body.contacts[0].wa_id)
                    .then((responseSearchField) => {
                      if (responseSearchField.length !== 0) {
                        ninoxService.getField(responseSearchField[0])
                          .then((responseGetField) => {
                            void taskService.createTask(
                              new SchemaTask(
                                body.contacts[0].wa_id,
                                body.messages[0][body.messages[0].type].body,
                                [responseGetField.fields.Nombre]
                              ).task)
                            void whatsappService.sendMessageWhatsapp(
                              {
                                text: `Hola ${String(responseGetField.fields.Nombre)}, soy tu asistente virtual Veronica 🧝‍♂️. Para poder ayudarte con lo que me pides, sigue los siguientes pasos:`,
                                options: {
                                  preview_url: false
                                }
                              },
                              'text',
                              String(process.env.ID_NUMBER),
                              String(process.env.WP_TOKEN),
                              body.messages[0].from
                            )
                            resolve('approved')
                          })
                          .catch((error) => {
                            reject(error)
                            apiErrorHandler(error, res, 'Error al extraer registro.')
                          })
                      } else {
                        resolve('denied')
                      }
                    })
                    .catch((error) => {
                      reject(error)
                      apiErrorHandler(error, res, 'Error al revisar la existencia del numero en ninox.')
                    })
                }
                resolve('denied')
              } else {
                if (responseGetTaskById[indexTasks].data().status !== 'DONE' && responseGetParameterForAnswerTask.validation === 'approved') {
                  const array = responseGetTaskById[indexTasks].data().sequence_task
                  array.push(responseGetParameterForAnswerTask.content)
                  void taskService.updateTask(responseGetTaskById[indexTasks].id, {
                    sequence_task: array,
                    status: responseGetParameterForAnswerTask.status
                  }) // Completar
                }
                if (body.messages[0].type === 'text') {
                  if (body.messages[0][body.messages[0].type].body === 'Terminar') {
                    void taskService.updateTask(responseGetTaskById[indexTasks].id, {
                      status: 'CLOSE'
                    })
                    resolve('denied')
                  }
                  if (responseGetTaskById[indexTasks].data().sequence_task.length >= 3) {
                    void whatsappService.sendMessageWhatsapp(
                      {
                        text: `Hola que tal!!, soy tu asistente virtual Veronica 🧝‍♂️.Te cuento que el inventarista ${String(responseGetTaskById[indexTasks].data().sequence_task[0])} acaba de subir un inventario al inmueble ${String(responseGetTaskById[indexTasks].data().sequence_task[2])}, revisalo cuando quieras 😊.`,
                        options: {
                          preview_url: false
                        }
                      },
                      'text',
                      String(process.env.ID_NUMBER),
                      String(process.env.WP_TOKEN),
                      body.messages[0].from
                    )
                  }
                }
                resolve('approved')
              }
            })
              .then((authorization) => {
                if (authorization === 'approved') {
                  if (responseGetParameterForAnswerTask.response_type === 'wp' && responseGetTaskById[indexTasks].data().status !== 'CLOSE') {
                    whatsappService.sendMessageWhatsapp(
                      responseGetParameterForAnswerTask.parameters,
                      responseGetParameterForAnswerTask.type,
                      String(process.env.ID_NUMBER),
                      String(process.env.WP_TOKEN),
                      body.messages[0].from)
                      .then(() => {
                        res.send('EVENT_RECEIVED')
                      }).catch((error) => {
                        apiErrorHandler(error, res, 'Error al enviar respuesta.')
                      })
                  } else if (responseGetTaskById[indexTasks].data().status !== 'CLOSE') {
                    switch (responseGetTaskById[indexTasks].data().type_task) {
                      case 'Fotos':{
                        whatsappService.getMediaMessage(
                          String(process.env.WP_TOKEN),
                          responseGetParameterForAnswerTask.id_image)
                          .then((image) => {
                            const fileName = String(responseGetParameterForAnswerTask.id_image) + '.' + String(image.headers['content-type'].substr(Number(image.headers['content-type'].indexOf('/')) + 1))
                            const localFilePath = path.resolve(__dirname,
                              'downloads',
                              fileName)
                            const downloadFile = image.data.pipe(fs.createWriteStream(localFilePath))
                            downloadFile.on('finish', () => {
                              const form = new FormData()
                              form.append(fileName, fs.createReadStream(localFilePath))
                              ninoxService.uploadImage(form)
                                .then(() => {
                                  fs.unlink(localFilePath, (error) => {
                                    if (error != null) {
                                      apiErrorHandler(error, res, 'Error al eliminar la foto ya subida.')
                                    }
                                  })
                                  res.send('EVENT_RECEIVED')
                                })
                                .catch((error) => {
                                  apiErrorHandler(error, res, 'Error al subir la imagen a servidor de ninox.')
                                })
                            })
                          }).catch((error) => {
                            apiErrorHandler(error, res, 'Error al enviar mensaje de whatsapp.')
                          })
                        break
                      }
                      case 'Ayuda':
                        ninoxService.createField(
                          [{
                            fields: {
                              Departamento: (responseGetTaskById[indexTasks].data().sequence_task)[1],
                              Numero: responseGetTaskById[indexTasks].data().external_id,
                              Descripcion: (responseGetTaskById[indexTasks].data().sequence_task)[2]
                            }
                          }]
                        )
                          .then(() => {
                            whatsappService.sendMessageWhatsapp(
                              responseGetParameterForAnswerTask.parameters,
                              responseGetParameterForAnswerTask.type,
                              String(process.env.ID_NUMBER),
                              String(process.env.WP_TOKEN),
                              body.messages[0].from)
                              .then(() => {
                                res.send('EVENT_RECEIVED')
                              }).catch((error) => {
                                apiErrorHandler(error, res, 'Error al enviar respuesta.')
                              })
                          })
                          .catch((error) => {
                            apiErrorHandler(error, res, 'Error al crear registro en Ninox.')
                          })
                        break
                    }
                  }
                } else {
                  res.send('EVENT_RECEIVED')
                }
              })
              .catch((error) => {
                apiErrorHandler(error, res, 'Error en extraccion de funcionario de inventario.')
              })
          }
        }).catch((error) => {
          apiErrorHandler(error, res, 'Error al revisar tareas existentes en firebase.')
        })
    } catch (error) {
      res.status(400).send('NOT_RECEIVED')
    }
  }

  /* requestTypeTask (body: any,
    responseGetTaskById: any,
    responseGetParameterForAnswerTask: any
  ): void {
  }
 */
  requestTypeConversation ({ body }: Request, res: Response): void {
    const id = body.contacts[0].wa_id
    conversationService.getConversationById(id).then((responseGetConversationById) => {
      new Promise((resolve, reject) => {
        if (responseGetConversationById[0] != null) {
          resolve(responseGetConversationById[0].id)
        } else {
          (async (): Promise<DocumentReference<DocumentData>> => {
            return await conversationService.createConversation(
              new SchemaConversation(
                id,
                body.contacts[0].profile.name,
                body.messages[0].from,
                body.messages[0].id
              ).conversation)
          })().then((responseCreateConversation) => resolve(responseCreateConversation.id))
            .catch((error) => reject(error))
        }
      }).then((idConversation) => {
        const schemaMessage = new SchemaMessage(
          body.messages[0].id,
          body.messages[0].from,
          body.messages[0].type,
          body.messages[0][body.messages[0].type]
        )
        messageService.createMessage(
          schemaMessage.message,
          idConversation
        ).then(() => {
          res.send('EVENT_RECEIVED')
        }).catch((error) => {
          throw new Error('ERROR: CREACION DEL MENSAJE - ' + String(error))
        })
      }).catch((error) => {
        throw new Error('ERROR: EXTRACCION DE ID - ' + String(error))
      })
    }).catch((error) => {
      throw new Error('ERROR: REVISION DE CONVERSACION EXISTENTE - ' + String(error))
    })
  }

  /* taskDone (
    type: string,
    parameters: any,
    token: string
  ): void {
  } */
}
