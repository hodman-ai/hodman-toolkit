import fs from 'node:fs/promises'
import readline from 'node:readline'

export async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8').replace(/[\r\n]+$/, '')
}

export async function readTextInput(options: { value?: string | null; file?: string | null; stdin?: boolean }): Promise<string> {
  if (options.file) return fs.readFile(options.file, 'utf8')
  if (options.stdin) return readStdin()
  return String(options.value ?? '')
}

export async function promptHidden(label: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('interactive_tty_required_use_password_stdin')
  }
  return new Promise((resolve, reject) => {
    const input = process.stdin
    const output = process.stderr
    output.write(label)
    input.setRawMode(true)
    input.resume()
    input.setEncoding('utf8')
    let value = ''
    const cleanup = () => {
      input.setRawMode(false)
      input.pause()
      input.removeListener('data', onData)
      output.write('\n')
    }
    const onData = (chunk: string) => {
      if (chunk === '\u0003') {
        cleanup()
        reject(new Error('cancelled'))
        return
      }
      if (chunk === '\r' || chunk === '\n') {
        cleanup()
        resolve(value)
        return
      }
      if (chunk === '\u007f' || chunk === '\b') {
        value = value.slice(0, -1)
        return
      }
      value += chunk
    }
    input.on('data', onData)
  })
}

export async function promptLine(label: string): Promise<string> {
  if (!process.stdin.isTTY) throw new Error('interactive_tty_required')
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr })
  return new Promise((resolve) => rl.question(label, (answer) => {
    rl.close()
    resolve(answer.trim())
  }))
}
