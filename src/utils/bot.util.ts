import { ninoxService } from '../services/ninox.service'
import { taskService, SchemaTask } from '../services/task.service'
import whatsappService from '../services/whatsapp.service'
import { chatGPTService } from '../services/chatGPT.service'
import { fileUtil } from '../utils/file.util'
import { apiErrorHandler } from '../handlers/error.handler'
class Bot {
  async processExistingTask (message: any, existingTask: any, res: any): Promise<void> {
    try {
      // Obtener el estado actual del usuario
      const currentStep = existingTask.data().status
      switch (currentStep) {
        case 'phone':
          await this.processPhoneStep(message, existingTask, res)
          break
        case 'pin':
          await this.processPinStep(message, existingTask, res)
          break
        case 'address':
          await this.processAddressStep(message, existingTask, res)
          break
        case 'menu':
          await this.processMenuStep(message, existingTask, res)
          break
        case 'query':
          await this.processQueryStep(message, res)
          break
        case 'document':
          await this.processDocumentStep(message, existingTask, res)
          break
        default:
          await this.sendErrorMessage(message, res)
          break
      }
    } catch (error) {
      apiErrorHandler(error, res, 'processExistingTask: Se produjo un error al procesar la tarea existente.')
    }
  }

  async processNewTask (body: any, res: any): Promise<void> {
    try {
      await taskService.createTask(
        new SchemaTask(
          body.contacts[0].wa_id,
          '',
          []
        ).task
      )
      await whatsappService.sendMessageWhatsapp(
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
    } catch (error) {
      apiErrorHandler(error, res, 'processNewTask: Se produjo un error al procesar la nueva tarea.')
    }
  }

  async processPhoneStep (body: any, task: any, res: any): Promise<void> {
    try {
      const identificationNumber = body.messages[0][body.messages[0].type].body

      // Verificar si el número de identificación es válido
      const isValidIdentification = await ninoxService.searchPersonByIdentification(identificationNumber)

      if (!isValidIdentification) {
        // Número de identificación inválido
        const errorMessage = 'El número de identificación ingresado no es válido. Por favor, intenta nuevamente.'
        await whatsappService.sendMessageWhatsapp(
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
        await taskService.updateTask(task.id, {
          sequence_task: array,
          status: 'pin'
        })

        const pinMessage = '¡Número de identificación válido! Ahora, ingresa tu PIN:'
        await whatsappService.sendMessageWhatsapp(
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
    } catch (error) {
      apiErrorHandler(error, res, 'processPhoneStep:Se produjo un error al procesar el paso de Identficacion.')
    }
  }

  async processPinStep (message: any, task: any, res: any): Promise<void> {
    try {
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
        await taskService.updateTask(task.id, {
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
          },
          'list',
          String(process.env.ID_NUMBER),
          String(process.env.WP_TOKEN),
          message.messages[0].from
        )
      }
    } catch (error) {
      apiErrorHandler(error, res, 'processPinStep: Se produjo un error al procesar el paso del PIN.')
    }
  }

  async processAddressStep (message: any, task: any, res: any): Promise<void> {
    try {
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
        const isCorrectAddress = await ninoxService.getInmuebleByAddress(message.messages[0][message.messages[0].type].list_reply.id)

        if (!isCorrectAddress) {
          const array = task.data().sequence_task
          array.push(message.messages[0][message.messages[0].type].list_reply.title)
          await taskService.updateTask(task.id, {
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
    } catch (error) {
      apiErrorHandler(error, res, 'processAddressStep: Se produjo un error al procesar el paso de la dirección.')
    }
  }

  async processMenuStep (message: any, task: any, res: any): Promise<void> {
    try {
      const menuOption = String(message.messages[0][message.messages[0].type].text).toLowerCase()
      switch (menuOption) {
        case 'consulta': {
          await taskService.updateTask(task.id, {
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
          await taskService.updateTask(task.id, {
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
    } catch (error) {
      apiErrorHandler(error, res, 'processMenuStep: Se produjo un error al procesar el paso del menú.')
    }
  }

  async processQueryStep (message: any, res: any): Promise<void> {
    try {
      let isText = false
      Object.entries(message.messages[0]).forEach(([key, _value]) => {
        if (key === 'text') {
          isText = true
        }
      })
      if (!isText) {
        await whatsappService.sendMessageWhatsapp(
          {
            bodyText: 'La respuesta no es válida. Por favor, escribe la consulta en texto.',
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
        const prompt = 'Necesito que respondas a la siguiente como si fueras un agente de servicio al cliente, tu respuesta será reflejada en el chat de un bot, por lo que las respuestas que generes no pueden ser largas. La consulta que hace el cliente es la siguiente:'
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
    } catch (error) {
      apiErrorHandler(error, res, 'processQueryStep: Se produjo un error al procesar el paso de consulta.')
    }
  }

  async processDocumentStep (message: any, task: any, res: any): Promise<void> {
    try {
      const documentOption = String(message.messages[0].type) + String(message.messages[0][message.messages[0].type].text).toLowerCase()
      switch (documentOption) {
        case 'buttoninventario': {
          // Obtener el inventario desde Ninox
          const contractDocument = await ninoxService.getInventoryDocumentByAddress(task.data().sequence_task[2])
          const name = await fileUtil.downloadBufferAsFile(contractDocument)
          const document = await fileUtil.openStreamAndgetFileFormData(name)
          const id = await whatsappService.uploadDocumentId(
            document,
            String(process.env.ID_NUMBER),
            String(process.env.WP_TOKEN)
          )
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
            String(process.env.WP_TOKEN)
          )
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
    } catch (error) {
      apiErrorHandler(error, res, 'processDocumentStep: Se produjo un error al procesar el paso de documento.')
    }
  }

  async sendErrorMessage (message: any, res: any): Promise<void> {
    try {
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
    } catch (error) {
      apiErrorHandler(error, res, 'sendErrorMessage: Se produjo un error al enviar el mensaje de error.')
    }
  }
}

export default new Bot()
