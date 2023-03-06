import { Request, Response } from 'express'
import { DocumentData, DocumentReference } from 'firebase/firestore'
import { conversationService } from '../services/conversation.service'
import { messageService, SchemaMessage } from '../services/message.service'
import whatsappService from '../services/whatsapp.service'
import { SchemaConversation } from '../types/conversation.types'
import { apiErrorHandler } from '../handlers/error.handler'

export default class MessageController {
  sendMessage ({ body }: Request, res: Response): void {
    try {
      whatsappService.sendMessageWhatsapp(
        body.parameters,
        body.type,
        body.from,
        body.token,
        body.parameters.to)
        .then((responseSendMessageWhatsapp) => {
          console.log(responseSendMessageWhatsapp)
          new Promise((resolve, reject) => {
            if (body.conversation_id != null) {
              resolve(body.conversation_id)
            } else {
              (async (): Promise<DocumentReference<DocumentData>> => {
                return await conversationService.createConversation(
                  new SchemaConversation(
                    responseSendMessageWhatsapp.response_whatsapp.whatsappId,
                    body.parameters.to,
                    body.from,
                    responseSendMessageWhatsapp.response_whatsapp.messageId
                  ).conversation)
              })().then((responseCreateConversation) => {
                resolve(responseCreateConversation.id)
              })
                .catch((error) => {
                  reject(error)
                })
            }
          }).then((responseId) => {
            const schemaMessage = new SchemaMessage(
              responseSendMessageWhatsapp.response_whatsapp.messageId,
              body.parameters.to,
              body.type,
              responseSendMessageWhatsapp[body.type]
            )
            console.log(responseId)
            messageService.createMessage(schemaMessage.message, responseId)
              .then((responseCreateMessage) => {
                res.send(responseCreateMessage)
              }).catch((error) => {
                apiErrorHandler(error, res, 'Error al guardar mensaje en Firebase.')
              })
          }).catch((error) => {
            apiErrorHandler(error, res, 'Error al al obtener id.')
          })
        }).catch((error) => {
          apiErrorHandler(error, res, 'Error al enviar mensaje por api cloud.')
        })
    } catch (error) {
      res.status(400).send('NOT_RECEIVED')
    }
  }
}
