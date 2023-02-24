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
          const responseGetParameterForAnswerTask = botUtil.getParameterForAnswerTask({
            answer: (responseGetTaskById[0] === undefined
              ? 1
              : (responseGetTaskById[0].data().sequence_task).length as number + 1
            ),
            response: body.messages[0]
          },
          (body.messages[0].type === 'text' && responseGetTaskById[0] === undefined
            ? body.messages[0][body.messages[0].type].body
            : (responseGetTaskById[0] === undefined
                ? 'No task'
                : responseGetTaskById[0].data().type_task)
          ))
          if (Object.entries(responseGetParameterForAnswerTask).length === 0 &&
            responseGetTaskById[0] === undefined) {
            res.send('ES UNA CONVERSACION')
          } else {
            if (responseGetTaskById[0] === undefined) {
              void taskService.createTask(
                new SchemaTask(
                  body.contacts[0].wa_id,
                  body.messages[0][body.messages[0].type].body,
                  [body.messages[0][body.messages[0].type].body]
                ).task)
            } else {
              if (responseGetTaskById[0].data().status !== 'DONE' && responseGetParameterForAnswerTask.validation === 'approved') {
                const array = responseGetTaskById[0].data().sequence_task
                array.push(responseGetParameterForAnswerTask.content)
                void taskService.updateTask(responseGetTaskById[0].id, {
                  sequence_task: array,
                  status: responseGetParameterForAnswerTask.status
                }) // Completar
              }
            }
            if (responseGetParameterForAnswerTask.response_type === 'wp') {
              whatsappService.sendMessageWhatsapp(
                responseGetParameterForAnswerTask.parameters,
                responseGetParameterForAnswerTask.type,
                '113492004941110',
                'EAAFlbvoSH6YBADcKVZA1wA5AnwVkHX152iKDkQa1wzlllVPAdffwmzr0GULuxG3hIy3x6xHDhVEi8QROdaLXS0dTFmfqoEjiAIXKMY4qvbAuNW3ognn3R25AkpTBOWAdmb3IM2rpxrLmJZB9oDRkUVfoIS871rakUX2Hm1NBxG6XTAUcHJCeSGSuJNv5tYOXizzLERrgZDZD',
                body.messages[0].from)
                .then(() => {
                  res.send('EVENT_RECEIVED')
                }).catch((error) => {
                  apiErrorHandler(error, res, 'Error al enviar respuesta.')
                })
            } else {
              switch (responseGetTaskById[0].data().type_task) {
                case 'Subir imagenes':{
                  whatsappService.getMediaMessage(
                    'EAAFlbvoSH6YBADcKVZA1wA5AnwVkHX152iKDkQa1wzlllVPAdffwmzr0GULuxG3hIy3x6xHDhVEi8QROdaLXS0dTFmfqoEjiAIXKMY4qvbAuNW3ognn3R25AkpTBOWAdmb3IM2rpxrLmJZB9oDRkUVfoIS871rakUX2Hm1NBxG6XTAUcHJCeSGSuJNv5tYOXizzLERrgZDZD',
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
                        Departamento: (responseGetTaskById[0].data().sequence_task)[1],
                        Numero: responseGetTaskById[0].data().external_id,
                        Descripcion: (responseGetTaskById[0].data().sequence_task)[2]
                      }
                    }]
                  )
                    .then(() => {
                      whatsappService.sendMessageWhatsapp(
                        responseGetParameterForAnswerTask.parameters,
                        responseGetParameterForAnswerTask.type,
                        '113492004941110',
                        'EAAFlbvoSH6YBADcKVZA1wA5AnwVkHX152iKDkQa1wzlllVPAdffwmzr0GULuxG3hIy3x6xHDhVEi8QROdaLXS0dTFmfqoEjiAIXKMY4qvbAuNW3ognn3R25AkpTBOWAdmb3IM2rpxrLmJZB9oDRkUVfoIS871rakUX2Hm1NBxG6XTAUcHJCeSGSuJNv5tYOXizzLERrgZDZD',
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
