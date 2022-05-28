import { api } from '@aviutil-toys/api/client'
import { Box, Button, ButtonGroup, Flex, Heading, Textarea, useToast } from '@chakra-ui/react'
import React, { createContext, useState } from 'react'
import type { ReadOptions } from 'softalk'

import { Options } from './components/options'
import { Presets } from './components/presets'

import { ipc } from '@/client/api'

const StatusChecker: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true)
  const [isEnabled, setIsEnabled] = useState(false)
  if (isLoading) {
    ipc.invoke('enabled').then((enabled) => {
      setIsLoading(false)
      setIsEnabled(enabled)
    })
    return <></>
  }
  return isEnabled ? (
    <>{children}</>
  ) : (
    <Box>
      <Heading size="md" color="red">
        Softalk is not enabled.
      </Heading>
    </Box>
  )
}

const CheckReadOptions = (options: Partial<ReadOptions>): options is ReadOptions => {
  return (
    options.voice !== undefined &&
    options.speed !== undefined &&
    options.speed >= 0 &&
    options.speed <= 300 &&
    options.speed % 1 === 0 &&
    options.interval !== undefined &&
    options.interval >= 0 &&
    options.interval <= 200 &&
    options.interval % 1 === 0
  )
}

type SofTalkContextType = {
  readOptions: Partial<ReadOptions>
  setReadOptions: (readOptions: Partial<ReadOptions>) => void
}

export const SofTalkContext = createContext<SofTalkContextType>({} as SofTalkContextType)

export const SofTalk: React.FC = () => {
  const toast = useToast()
  const [dragFile, setDragFile] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [readOptions, setReadOptions] = useState<Partial<ReadOptions>>({
    voice: 0,
    speed: 100,
    interval: 100,
  })
  return (
    <StatusChecker>
      <SofTalkContext.Provider
        value={{
          readOptions,
          setReadOptions,
        }}
      >
        <Box>
          <Textarea
            placeholder="ここにテキストを入力してください"
            value={text}
            onChange={(e) => {
              setDragFile(null)
              setText(e.currentTarget.value)
            }}
            size="lg"
          />
          <ButtonGroup m="2">
            <Button
              onClick={async () => {
                if (!text)
                  return toast({
                    title: 'テキストが空です',
                    description: 'テキストを入力してください',
                    status: 'error',
                    duration: 3000,
                  })
                if (!CheckReadOptions(readOptions)) return
                const file = await ipc.invoke('voice:craete', text, readOptions)
                setDragFile(file)
              }}
            >
              合成
            </Button>
            <Button
              onClick={() => {
                if (!text) return
                if (CheckReadOptions(readOptions)) {
                  ipc.invoke('voice:play', text, readOptions)
                }
              }}
            >
              再生
            </Button>
            <Flex
              justifyContent="center"
              alignItems="center"
              px="4"
              border="2px"
              borderStyle="dotted"
              draggable
              onDragStart={(e) => {
                if (!dragFile) return
                e.preventDefault()
                api.invoke('native:drag-file', dragFile)
              }}
            >
              <Heading size="sm">
                {dragFile
                  ? 'ここをドラッグしてAviutilに読みいこませて下さい。'
                  : '合成ボタンを押して音声を生成します。'}
              </Heading>
            </Flex>
          </ButtonGroup>
          <Options />
          <Presets />
        </Box>
      </SofTalkContext.Provider>
    </StatusChecker>
  )
}
