import { Request, Response } from 'express'
import { ninoxService } from '../services/ninox.service'
import { taskService, SchemaTask } from '../services/task.service'
import whatsappService from '../services/whatsapp.service'
import { chatGPTService } from '../services/chatGPT.service'
import { fileUtil } from '../utils/file.util'

export default class WhatsappController {
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
          if ((responseGetTaskById[indexTasks] === undefined || responseGetTaskById[indexTasks].data().status === 'CLOSE') ||
          (responseGetTaskById[indexTasks].data().sequence_task).length as number === 0) {
            void this.processNewTask(body)
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
              void this.processExistingTask(body, responseGetTaskById[indexTasks])
            }
          }
        }).catch(() => {
          res.status(400).send('NOT_RECEIVED')
        })
      res.status(200).send('RECEIVED')
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

  private async processExistingTask (message: any, existingTask: any): Promise<void> {
    // Obtener el estado actual del usuario
    const currentStep = existingTask.data().status

    switch (currentStep) {
      case 'phone':
        await this.processPhoneStep(message, existingTask)
        break
      case 'pin':
        await this.processPinStep(message, existingTask)
        break
      case 'address':
        await this.processAddressStep(message, existingTask)
        break
      case 'menu':
        await this.processMenuStep(message, existingTask)
        break
      case 'query':
        await this.processQueryStep(message)
        break
      case 'document':
        await this.processDocumentStep(message, existingTask)
        break
      default:
        await this.sendErrorMessage(message)
        break
    }
  }

  private async processNewTask (body: any): Promise<void> {
    void taskService.createTask(
      new SchemaTask(
        body.contacts[0].wa_id,
        body.messages[0][body.messages[0].type].body,
        []
      ).task)
    void whatsappService.sendMessageWhatsapp(
      {
        text: '¡Bienvenido! \n Por favor, ingresa tu número de identificación:',
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

  private async processPhoneStep (body: any, task: any): Promise<void> {
    const identificationNumber = body.messages[0][body.messages[0].type].body

    // Verificar si el número de identificación es válido
    const isValidIdentification = await ninoxService.searchPersonByIdentification(identificationNumber)

    if (!isValidIdentification) {
      // Número de identificación inválido
      const errorMessage = 'El número de identificación ingresado no es válido. Por favor, intenta nuevamente.'
      void whatsappService.sendMessageWhatsapp(
        {
          text: errorMessage,
          options: {
            preview_url: false
          }
        },
        'text',
        String(process.env.ID_NUMBER),
        String(process.env.WP_TOKEN),
        body.messages[0].from
      )
    } else {
      // Número de identificación válido
      const array = task.data().sequence_task
      array.push(body.messages[0][body.messages[0].type].body)
      void taskService.updateTask(task.id, {
        sequence_task: array,
        status: 'pin'
      })

      const pinMessage = '¡Número de identificación válido! Ahora, ingresa tu PIN:'
      void whatsappService.sendMessageWhatsapp(
        {
          text: pinMessage,
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

  private async processPinStep (message: any, task: any): Promise<void> {
    const pin = message.messages[0][message.messages[0].type].body
    const identificationNumber = task.data().sequence_task[0]

    // Verificar si el PIN es correcto
    const isCorrectPin = await ninoxService.checkPinMatch(identificationNumber, pin)

    if (!isCorrectPin) {
      // PIN incorrecto
      const errorMessage = 'El PIN ingresado es incorrecto. Por favor, intenta nuevamente o ingresa tu número de identificación para volver a empezar.'
      await whatsappService.sendMessageWhatsapp(
        {
          bodyText: errorMessage,
          buttons: {
            inicio: 'Ingresar identificación'
          },
          options: {
            // Opciones adicionales, si es necesario
          }
        },
        'button',
        String(process.env.ID_NUMBER),
        String(process.env.WP_TOKEN),
        message.messages[0].from
      )
    } else {
      // PIN correcto
      const array = task.data().sequence_task
      array.push(message.messages[0][message.messages[0].type].body)
      void taskService.updateTask(task.id, {
        sequence_task: array,
        status: 'address'
      })

      const addresses = await ninoxService.getAddressByIdentification(identificationNumber)
      await whatsappService.sendMessageWhatsapp(
        {
          buttonName: 'Inmuebles',
          bodyText: 'Por favor, selecciona uno de los inmuebles de la lista a continuación para recibir información detallada:',
          sections: {
            Direcciones: addresses
          },
          options: {
            // Opciones adicionales, si es necesario
          }
        }
        ,
        'list',
        String(process.env.ID_NUMBER),
        String(process.env.WP_TOKEN),
        message.messages[0].from
      )
    }
  }

  private async processAddressStep (message: any, task: any): Promise<void> {
    let booleano = false
    Object.entries(message.messages[0]).forEach(([key, _value]) => {
      if (key === 'interactive') {
        booleano = true
      }
    })
    if (!booleano) {
      // Selección de dirección inválida
      const errorMessage = 'La opción seleccionada no es válida. Por favor, selecciona una opción válida.'
      await whatsappService.sendMessageWhatsapp(
        {
          bodyText: errorMessage,
          buttons: {
            inicio: 'Ingresar identificación'
          },
          options: {
            // Opciones adicionales, si es necesario
          }
        },
        'button',
        String(process.env.ID_NUMBER),
        String(process.env.WP_TOKEN),
        message.messages[0].from
      )
    } else {
      const isCorrecAddress = await ninoxService.getInmuebleByAddress(message.messages[0][message.messages[0].type].list_reply.id)

      if (!isCorrecAddress) {
        const array = task.data().sequence_task
        array.push(message.messages[0][message.messages[0].type].list_reply.title)
        void taskService.updateTask(task.id, {
          sequence_task: array,
          status: 'menu'
        })
        const errorMessage = 'La opción seleccionada no es válida. Por favor, selecciona una opción válida.'
        await whatsappService.sendMessageWhatsapp(
          {
            bodyText: errorMessage,
            buttons: {
              inicio: 'Ingresar número de identificación'
            },
            options: {
              // Opciones adicionales, si es necesario
            }
          },
          'button',
          String(process.env.ID_NUMBER),
          String(process.env.WP_TOKEN),
          message.messages[0].from
        )
      } else {
        await whatsappService.sendMessageWhatsapp(
          {
            bodyText: 'Por favor, selecciona el tipo de asistencia que necesitas de las opciones a continuación:',
            buttons: {
              Consulta: 'Consultas',
              Documento: 'Documentación',
              inicio: 'Ingresar identificación'
            },
            options: {
              // Opciones adicionales, si es necesario
            }
          },
          'button',
          String(process.env.ID_NUMBER),
          String(process.env.WP_TOKEN),
          message.messages[0].from
        )
      }
    }
  }

  private async processMenuStep (message: any, task: any): Promise<void> {
    const menuOption = String(message.messages[0][message.messages[0].type].text).toLowerCase()
    switch (menuOption) {
      case 'consulta': {
        void taskService.updateTask(task.id, {
          status: 'query'
        })
        await whatsappService.sendMessageWhatsapp(
          {
            bodyText: '¿En qué puedo ayudarte?',
            buttons: {
              Menu: 'Volver al menú'
            },
            options: {
              // Opciones adicionales, si es necesario
            }
          },
          'button',
          String(process.env.ID_NUMBER),
          String(process.env.WP_TOKEN),
          message.messages[0].from
        )
        break
      }
      case 'documento': {
        void taskService.updateTask(task.id, {
          status: 'document'
        })
        await whatsappService.sendMessageWhatsapp(
          {
            bodyText: 'Selecciona un tipo de documento:',
            buttons: {
              Contrato: 'Contrato',
              Inventario: 'Inventario',
              Menu: 'Volver al menú'
            },
            options: {
              // Opciones adicionales, si es necesario
            }
          },
          'button',
          String(process.env.ID_NUMBER),
          String(process.env.WP_TOKEN),
          message.messages[0].from
        )
        break
      }
      default:
        await whatsappService.sendMessageWhatsapp(
          {
            bodyText: 'La opción seleccionada no es válida. Por favor, selecciona una opción válida:',
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
          message.messages[0].from
        )
        break
    }
  }

  private async processQueryStep (message: any): Promise<void> {
    let isText = false
    Object.entries(message.messages[0]).forEach(([key, _value]) => {
      if (key === 'text') {
        isText = true
      }
    })
    if (!isText) {
      await whatsappService.sendMessageWhatsapp(
        {
          bodyText: 'La respuesta no es valida. Porfavor, escribe la consulta en texto.',
          buttons: {
            Menu: 'Volver al menú'
          },
          options: {
            // Opciones adicionales, si es necesario
          }
        },
        'button',
        String(process.env.ID_NUMBER),
        String(process.env.WP_TOKEN),
        message.messages[0].from
      )
    } else {
      const prompt = 'Necesito que respondas a la siguiente como si fueras un agente de servicio al cliente, tu respuesta sera reflejada en el chat de un bot, por lo que las respuestas que generes no pueden ser largas, la consulta que hace el cliente es el siguiente:'
      const response = await chatGPTService.requestChatGPT(prompt + String(message.messages[0][message.messages[0].type].body))
      await whatsappService.sendMessageWhatsapp(
        {
          bodyText: response,
          buttons: {
            Menu: 'Volver al menú'
          },
          options: {
            // Opciones adicionales, si es necesario
          }
        },
        'button',
        String(process.env.ID_NUMBER),
        String(process.env.WP_TOKEN),
        message.messages[0].from
      )
    }
  }

  private async processDocumentStep (message: any, task: any): Promise<void> {
    const documentOption = String(message.messages[0].type) + String(message.messages[0][message.messages[0].type].text).toLowerCase()
    switch (documentOption) {
      case 'buttoninventario':{
        // Obtener el inventario desde Ninox
        const contractDocument = await ninoxService.getInventoryDocumentByAddress(task.data().sequence_task[2])
        const name = await fileUtil.downloadBufferAsFile(contractDocument)
        const document = await fileUtil.openStreamAndgetFileFormData(name)
        const id = await whatsappService.uploadDocumentId(
          document,
          String(process.env.ID_NUMBER),
          String(process.env.WP_TOKEN))
        await whatsappService.sendMessageWhatsapp(
          {
            urlOrObjectId: id,
            options: {
              // Opciones adicionales, si es necesario
            }
          },
          'button',
          String(process.env.ID_NUMBER),
          String(process.env.WP_TOKEN),
          message.messages[0].from
        )
        await fileUtil.closeStreamAndDeleteFile(name)
        await whatsappService.sendMessageWhatsapp(
          {
            bodyText: 'Selecciona un tipo de documento:',
            buttons: {
              Contrato: 'Contrato',
              Inventario: 'Inventario',
              Menu: 'Volver al menú'
            },
            options: {
              // Opciones adicionales, si es necesario
            }
          },
          'button',
          String(process.env.ID_NUMBER),
          String(process.env.WP_TOKEN),
          message.messages[0].from
        )
        break
      }
      case 'buttoncontrato': {
        const contractDocument = await ninoxService.getContractDocumentByAddress(task.data().sequence_task[2])
        const name = await fileUtil.downloadBufferAsFile(contractDocument)
        const document = await fileUtil.openStreamAndgetFileFormData(name)
        const id = await whatsappService.uploadDocumentId(
          document,
          String(process.env.ID_NUMBER),
          String(process.env.WP_TOKEN))
        await whatsappService.sendMessageWhatsapp(
          {
            urlOrObjectId: id,
            options: {
              // Opciones adicionales, si es necesario
            }
          },
          'button',
          String(process.env.ID_NUMBER),
          String(process.env.WP_TOKEN),
          message.messages[0].from
        )
        await fileUtil.closeStreamAndDeleteFile(name)
        await whatsappService.sendMessageWhatsapp(
          {
            bodyText: 'Selecciona un tipo de documento:',
            buttons: {
              Contrato: 'Contrato',
              Inventario: 'Inventario',
              Menu: 'Volver al menú'
            },
            options: {
              // Opciones adicionales, si es necesario
            }
          },
          'button',
          String(process.env.ID_NUMBER),
          String(process.env.WP_TOKEN),
          message.messages[0].from
        )
        break
      }
      default: {
        // Opción de documento inválida
        const errorMessage = 'La opción seleccionada no es válida. Por favor, selecciona una opción válida:'
        await whatsappService.sendMessageWhatsapp(
          {
            bodyText: errorMessage,
            buttons: {
              Contrato: 'Contrato',
              Inventario: 'Inventario',
              Menu: 'Volver al menú'
            },
            options: {
              // Opciones adicionales, si es necesario
            }
          },
          'button',
          String(process.env.ID_NUMBER),
          String(process.env.WP_TOKEN),
          message.messages[0].from
        )
        break
      }
    }
  }

  private async sendErrorMessage (message: any): Promise<void> {
    const errorMessage = 'Ocurrió un error inesperado. Por favor, intenta nuevamente o comunícate con nuestro soporte.'
    await whatsappService.sendMessageWhatsapp(
      {
        bodyText: errorMessage,
        buttons: {
          Contrato: 'Contrato',
          Inventario: 'Inventario',
          Menu: 'Volver al menú'
        },
        options: {
          // Opciones adicionales, si es necesario
        }
      },
      'button',
      String(process.env.ID_NUMBER),
      String(process.env.WP_TOKEN),
      message.messages[0].from
    )
  }
}

// export const whatsappController = new WhatsappController()
