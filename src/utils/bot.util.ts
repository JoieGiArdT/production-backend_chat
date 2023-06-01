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
          await this.processQueryStep(message, existingTask)
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
          text: '¡Hola! 😊 ¡Nos alegra tenerte aquí! Por favor, introduce tu número de identificación para poder ayudarte mejor. ¡Estamos listos para atenderte! 💪👍',
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
        const errorMessage = '¡Oops! Parece que el número de identificación que ingresaste no es válido. Por favor, verifica y vuelve a intentarlo. Estamos aquí para ayudarte, así que no te preocupes, ¡estamos seguros de que encontraremos una solución juntos! 💪🔍✨'
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

        const pinMessage = '¡Genial! Has ingresado un número de identificación válido. Ahora, necesitamos que ingreses tu PIN para poder continuar. Por favor, introduce tu PIN y asegúrate de que sea correcto. ¡Estamos listos para atenderte! 🔐💼💬'
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
        const errorMessage = '¡Ups! Parece que el PIN que ingresaste no es correcto. Por favor, verifica que esté escrito correctamente y vuelve a intentarlo. Si sigues teniendo problemas, también puedes ingresar nuevamente tu número de identificación para comenzar desde el principio. ¡Estoy aquí para ayudarte! 🤔🔒💡'
        await whatsappService.sendMessageWhatsapp(
          {
            bodyText: errorMessage,
            buttons: {
              inicio: 'Volver al inicio'
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
        await whatsappService.sendMessageWhatsapp(
          {
            text: '¡Genial! Me alegra saber que pudimos autenticarte correctamente. Permíteme buscar los inmuebles en los que eres inquilino o propietario. Por favor, espera un momento mientras reviso la información. 🕵️‍♂️🔎',
            options: {
              preview_url: false
            }
          },
          'text',
          String(process.env.ID_NUMBER),
          String(process.env.WP_TOKEN),
          message.messages[0].from
        )
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
            bodyText: 'Por favor, selecciona el inmueble que deseas obtener información detallada. ¡Estoy aquí para ayudarte! 💼🏠🔍',
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
        const errorMessage = 'Oops, parece que has seleccionado una opción inválida. Por favor, elige una opción válida de la lista. ¡Estoy aquí para ayudarte! 😊👍'
        await whatsappService.sendMessageWhatsapp(
          {
            bodyText: errorMessage,
            buttons: {
              inicio: 'Volver al inicio'
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
        const isCorrectAddress = await ninoxService.getInmuebleByAddress(message.messages[0][message.messages[0].type].list_reply.title)

        if (!isCorrectAddress) {
          const errorMessage = 'Oops, parece que has seleccionado una opción inválida. Por favor, elige una opción válida de la lista. ¡Estoy aquí para ayudarte! 😊👍'
          await whatsappService.sendMessageWhatsapp(
            {
              bodyText: errorMessage,
              buttons: {
                inicio: 'Volver al inicio'
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
              text: '🤖 Estoy obteniendo información del inmueble seleccionado... Por favor, bríndame un momento mientras recopilo los detalles. ⏳🏠',
              options: {
                preview_url: false
              }
            },
            'text',
            String(process.env.ID_NUMBER),
            String(process.env.WP_TOKEN),
            message.messages[0].from
          )
          const info = await ninoxService.getInfoByAddress(message.messages[0][message.messages[0].type].list_reply.title)
          const array = task.data().sequence_task
          array.push(message.messages[0][message.messages[0].type].list_reply.title)
          array.push(info)
          await taskService.updateTask(task.id, {
            sequence_task: array,
            status: 'menu'
          })
          await whatsappService.sendMessageWhatsapp(
            {
              bodyText: '¡Perfecto! Estoy listo para ayudarte. Por favor, elige el tipo de asistencia que necesitas de las opciones a continuación. 😊👍',
              buttons: {
                Consulta: 'Consultas',
                Documento: 'Documentación',
                inicio: 'Volver al inicio'
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
      const menuOption = (message.messages[0]?.interactive?.button_reply?.title !== undefined)
        ? String(message.messages[0]?.interactive?.button_reply?.title).toLowerCase()
        : undefined
      switch (menuOption) {
        case 'consultas': {
          await taskService.updateTask(task.id, {
            status: 'query'
          })
          await whatsappService.sendMessageWhatsapp(
            {
              bodyText: 'Por supuesto, estoy aquí para ayudarte con cualquier consulta que tengas sobre el inmueble seleccionado. ¡No dudes en preguntarme cualquier cosa relacionada con él! Estoy aquí para brindarte toda la información que necesitas. 😊🏠',
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
        case 'documentación': {
          await taskService.updateTask(task.id, {
            status: 'document'
          })
          await whatsappService.sendMessageWhatsapp(
            {
              bodyText: '¡Claro! Para enviarte una copia del documento que necesitas, por favor selecciona el tipo de documento de la siguiente lista. Una vez que elijas, te lo enviaré de inmediato. 📝📩',
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
              bodyText: 'Lo siento, pero la opción que seleccionaste no es válida. Por favor, elige una opción válida de la lista proporcionada. 📋🔍',
              buttons: {
                Consulta: 'Consultas',
                Documento: 'Documentación',
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
    } catch (error) {
      apiErrorHandler(error, res, 'processMenuStep: Se produjo un error al procesar el paso del menú.')
    }
  }

  async processQueryStep (message: any, task: any): Promise<void> {
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
            bodyText: '¿Podrías brindarme más detalles o información adicional sobre tu consulta? De esta manera, podré comprenderte mejor y brindarte una respuesta más precisa y útil. ¡Estoy aquí para ayudarte! 😊',
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
        const info = String(JSON.stringify(task.data().sequence_task[3]))
        const prompt = `Necesito que respondas a esto: "${String(message.messages[0][message.messages[0].type].body)}"  como si fueras un agente de servicio al cliente y que sigas las siguientes intrucciones: Al recibir una solicitud del usuario, analiza el contenido para identificar la intención principal y determinar la información relevante necesaria para responder adecuadamente. No des la bienvenida, solo responde como si ya hubieran interactuado. Actúa como un agente de servicio al cliente de Financar, una reconocida inmobiliaria, manteniendo un tono cordial, profesional, agregando emogi y amigable en todas las interacciones. Verifica los campos del JSON proporcionado para obtener información específica, en el json hay informacion del inquilino, del inmueble y del contrato. Si la información requerida no está presente o es insuficiente, solicita al usuario más detalles o que repita la solicitud. En caso de no entender la solicitud o la intención del usuario, pide clarificación y repite la pregunta. Recuerda mantener un tono cordial y amigable en todas las respuestas, representando los valores de Financar. Actúa como un representante de la inmobiliaria, brindando un servicio al cliente de calidad. Estas instrucciones ayudarán a la inteligencia artificial a responder adecuadamente a las solicitudes del usuario y brindar un servicio al cliente efectivo y personalizado. Informacion del JSON= ${info}`
        const response = await chatGPTService.requestChatGPT(prompt)
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
        await whatsappService.sendMessageWhatsapp(
          {
            text: 'No dudes en consultarme cualquier detalle o información adicional que necesites. Estoy a tu disposición. 😊🏡',
            options: {
              preview_url: false
            }
          },
          'text',
          String(process.env.ID_NUMBER),
          String(process.env.WP_TOKEN),
          message.messages[0].from
        )
      }
    } catch (error) {
      console.log(error)
    }
  }

  async processDocumentStep (message: any, task: any, res: any): Promise<void> {
    try {
      const documentOption = (message.messages[0]?.interactive?.button_reply?.title !== undefined)
        ? String(message.messages[0]?.interactive?.button_reply?.title).toLowerCase()
        : undefined
      if (documentOption !== undefined) {
        await whatsappService.sendMessageWhatsapp(
          {
            text: '¡Excelente! Ya me encuentro trabajando en tu documento. Por favor, permíteme unos segundos para completar la tarea. Estoy dedicado a brindarte un resultado de calidad. ¡Gracias por tu paciencia! ⏳💼📄',
            options: {
              preview_url: false
            }
          },
          'text',
          String(process.env.ID_NUMBER),
          String(process.env.WP_TOKEN),
          message.messages[0].from
        )
      }
      switch (documentOption) {
        case 'inventario': {
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
            'document',
            String(process.env.ID_NUMBER),
            String(process.env.WP_TOKEN),
            message.messages[0].from
          )
          await fileUtil.closeStreamAndDeleteFile(name)
          await whatsappService.sendMessageWhatsapp(
            {
              bodyText: '¡Perfecto! Aquí tienes el documento que me pediste. 📄✅ \n Si necesitas alguno otro documento o tienes alguna otra consulta, por favor indícame y con gusto te lo proporcionaré. ¡Estoy aquí para ayudarte en lo que necesites! 🤖🔍💼',
              buttons: {
                Contrato: 'Contrato',
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
        case 'contrato': {
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
            'document',
            String(process.env.ID_NUMBER),
            String(process.env.WP_TOKEN),
            message.messages[0].from
          )
          await fileUtil.closeStreamAndDeleteFile(name)
          await whatsappService.sendMessageWhatsapp(
            {
              bodyText: '¡Perfecto! Aquí tienes el documento que me pediste. 📄✅ \n Si necesitas alguno otro documento o tienes alguna otra consulta, por favor indícame y con gusto te lo proporcionaré. ¡Estoy aquí para ayudarte en lo que necesites! 🤖🔍💼',
              buttons: {
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
          const errorMessage = 'Lo siento, pero la opción que seleccionaste no es válida. Por favor, elige una opción válida de la lista proporcionada. 📋🔍'
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
