import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import UnifiedMediaPickerPopover from './UnifiedMediaPickerPopover'
import MessageSticker from './MessageSticker'
import MessageGif from './MessageGif'

describe('UnifiedMediaPickerPopover', () => {
  it('renders emoji tab by default', () => {
    const html = renderToStaticMarkup(
      <UnifiedMediaPickerPopover
        serverId="s1"
        onSelectEmoji={() => {}}
        onSelectGif={() => {}}
        onSelectSticker={() => {}}
        onClose={() => {}}
      />
    )

    expect(html).toContain('Emojis')
    expect(html).toContain('GIFs')
    expect(html).toContain('Figurinhas')
    expect(html).toContain('Joinha')
  })

  it('renders MessageSticker component without crashing', () => {
    const html = renderToStaticMarkup(
      <MessageSticker
        sticker={{
          id: 'stk-1',
          server_id: 's1',
          name: 'doge',
          content_type: 'image/png'
        }}
      />
    )
    expect(html).toContain(':doge:')
  })

  it('renders MessageGif component without crashing', () => {
    const html = renderToStaticMarkup(
      <MessageGif
        gifUrl="https://media.giphy.com/test.gif"
        metadata={{ width: 400, height: 300 }}
      />
    )
    expect(html).toContain('GIF')
    expect(html).toContain('https://media.giphy.com/test.gif')
  })
})
