
import axios, { AxiosError } from 'axios'
import {
  Contact,
  ContactMessage,
  ImageMessage,
  InteractiveMessage,
  LocationMessage,
  Media,
  MediaBase,
  MediaMessage,
  TemplateComponent,
  TemplateMessage,
  TextMessage,
  Message
} from '../types/whatsapp.types'
// import { Request } from 'express'
interface PaylodBase {
  messaging_product: 'whatsapp'
  recipient_type: 'individual'
}

interface OfficialSendMessageResult {
  messaging_product: 'whatsapp'
  contacts: Array<{
    input: string
    wa_id: string
  }>
  messages: Array<{
    id: string
  }>
}

export interface SendMessageResult {
  messageId: string
  phoneNumber: string
  whatsappId: string
}

class WhatsappService {
  payloadBase: PaylodBase = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual'
  }

  getMediaPayload (urlOrObjectId: string, options?: MediaBase): Media {
    console.log({
      id: urlOrObjectId,
      caption: options?.caption,
      filename: options?.filename
    })
    return {
      id: urlOrObjectId,
      caption: options?.caption,
      filename: options?.filename
    }
  }

  async sendMessageWhatsapp (
    paramaters: any,
    typeMessage: string,
    fromPhoneNumberId: string,
    accessToken: string,
    toNumber: string
  ): Promise<any> {
    let callback
    switch (typeMessage) {
      case 'text': {
        callback = this.sendText
        break
      }
      case 'image':{
        callback = this.sendImage
        break
      }
      case 'document':{
        callback = this.sendDocument
        break
      }
      case 'audio':{
        callback = this.sendAudio
        break
      }
      case 'video':{
        callback = this.sendVideo
        break
      }
      case 'sticker':{
        callback = this.sendSticker
        break
      }
      case 'location':{
        callback = this.sendLocation
        break
      }
      case 'contacts':{
        callback = this.sendContacts
        break
      }
      case 'list':{
        typeMessage = 'interactive'
        callback = this.sendList
        break
      }
      case 'button':{
        typeMessage = 'interactive'
        callback = this.sendReplyButtons
        break
      }
      default:{
        throw new Error('TIPO_INCORRECTO')
      }
    }
    const baseInfo = callback(paramaters)
    const data: Message = {
      ...this.payloadBase,
      type: typeMessage,
      to: toNumber,
      ...baseInfo
    }
    return {
      response_whatsapp: await this.sendRequestMessage(
        data,
        fromPhoneNumberId,
        accessToken
      ),
      ...baseInfo
    }
  }

  async sendRequestMessage (
    data: Message,
    fromPhoneNumberId: string,
    accessToken: string,
    version: string = 'v17.0'
  ): Promise<SendMessageResult> {
    try {
      const { data: rawResult } = await axios(`https://graph.facebook.com/${version}/${fromPhoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        data
      })
      const result = rawResult as OfficialSendMessageResult

      return {
        messageId: result.messages?.[0]?.id,
        phoneNumber: result.contacts?.[0]?.input,
        whatsappId: result.contacts?.[0]?.wa_id
      }
    } catch (err: unknown) {
      console.error(err)
      // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
      if ((err as any).response) {
        throw (err as AxiosError)?.response?.data
        // } else if ((err as any).request) {
        //   throw (err as AxiosError)?.request;
      } else if (err instanceof Error) {
        // eslint-disable-next-line @typescript-eslint/no-throw-literal
        throw err.message
      } else {
        throw err
      }
    }
  }

  sendText (
    parameters: {
      text: string
      options: any
    }
  ): TextMessage {
    return {
      text: {
        body: parameters.text,
        preview_url: parameters.options.preview_url
      }
    }
  }

  sendImage (
    parameters: {
      urlOrObjectId: any
      options: any
    }
  ): ImageMessage {
    return {
      image: this.getMediaPayload(parameters.urlOrObjectId, parameters.options)
    }
  }

  sendDocument (
    parameters: {
      urlOrObjectId: any
      options: any
    }
  ): MediaMessage {
    return {
      document: {
        id: parameters.urlOrObjectId,
        ...parameters.options
      }
    }
  }

  sendAudio (
    parameters: {
      urlOrObjectId: any
    }
  ): MediaMessage {
    return {
      audio: this.getMediaPayload(parameters.urlOrObjectId)
    }
  }

  sendVideo (
    parameters: {
      urlOrObjectId: any
      options: any
    }
  ): MediaMessage {
    return {
      video: this.getMediaPayload(parameters.urlOrObjectId, parameters.options)
    }
  }

  sendSticker (
    parameters: {
      urlOrObjectId: any
    }
  ): MediaMessage {
    return {
      sticker: this.getMediaPayload(parameters.urlOrObjectId)
    }
  }

  sendLocation (
    parameters: {
      latitude: number
      longitude: number
      options: any
    }
  ): LocationMessage {
    return {
      location: {
        latitude: parameters.latitude,
        longitude: parameters.longitude,
        name: parameters.options?.name,
        address: parameters.options?.address
      }
    }
  }

  sendTemplate (
    parameters: {
      name: string
      languageCode: string
      components: TemplateComponent[]
    }
  ): TemplateMessage {
    return {
      template: {
        name: parameters.name,
        language: {
          code: parameters.languageCode
        },
        components: parameters.components
      }
    }
  }

  sendContacts (
    parameters: {
      contacts: Contact[]
    }
  ): ContactMessage {
    return {
      contacts: parameters.contacts
    }
  }

  sendReplyButtons (
    parameters: {
      bodyText: string
      buttons: string
      options: any
    }
  ): InteractiveMessage {
    return {
      interactive: {
        body: {
          text: parameters.bodyText
        },
        // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
        ...(parameters.options?.footerText
          ? {
              footer: { text: parameters.options?.footerText }
            }
          : {}),
        header: parameters.options?.header,
        type: 'button',
        action: {
          buttons: Object.entries(parameters.buttons).map(([key, value]) => ({
            type: 'reply',
            reply: {
              title: value,
              id: key
            }
          }))
        }
      }
    }
  }

  sendList (
    parameters: {
      buttonName: string
      bodyText: string
      sections: any[]
      options: any
    }
  ): InteractiveMessage {
    return {
      interactive: {
        body: {
          text: parameters.bodyText
        },
        // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
        ...(parameters.options?.footerText
          ? {
              footer: { text: parameters.options?.footerText }
            }
          : {}),
        header: parameters.options?.header,
        type: 'list',
        action: {
          button: parameters.buttonName,
          sections: Object.entries(parameters.sections).map(([key, value]) => ({
            title: key,
            rows: value
          }))
        }
      }
    }
  }

  async uploadDocumentId (
    data: any,
    fromPhoneNumberId: string,
    accessToken: string,
    version: string = 'v17.0'
  ): Promise<string> {
    return (await axios(`https://graph.facebook.com/${version}/${fromPhoneNumberId}/media`, {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data',
        Authorization: `Bearer ${accessToken}`
      },
      data
    })).data.id
  }

  async getMediaMessage (
    objectId: string,
    accessToken: string,
    version: string = 'v17.0'
  ): Promise<any> {
    const responseGetMedia = await axios(`https://graph.facebook.com/${version}/${objectId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    })
    return await axios(String(responseGetMedia.data.url), {
      method: 'GET',
      responseType: 'stream',
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    })
  }
}

export default new WhatsappService()
