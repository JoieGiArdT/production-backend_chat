
class ChatGPTService {
  private readonly apiKey = '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'
  async requestChatGPT (
    prompt: string
  ): Promise<string> {
    // const { ChatGPTAPI } = yield import('chatgpt');
    const { ChatGPTAPI } = await import('chatgpt')
    const api = new ChatGPTAPI({
      apiKey: this.apiKey
    })
    return (await api.sendMessage(prompt)).text
  }
}
const chatGPTService = new ChatGPTService()
export { chatGPTService }
