// ═══════════════════════════════════════════════════════════════
// 🍪 Cookie — Terminal UI (Ink-based React)
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import type { CookieAgent } from '../core/agent.js';
import type { StreamChunk } from '../providers/base.js';
import { theme } from './theme.js';
import { eventBus } from '../core/events.js';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'status';
  content: string;
  timestamp: number;
}

interface AppProps {
  agent: CookieAgent;
}

function Header() {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text color={theme.primary} bold>🍪 Cookie</Text>
        <Text color={theme.textDim}> — </Text>
        <Text color={theme.textMuted} italic>Crumbles bugs. Occasionally reality too.</Text>
      </Box>
      <Box>
        <Text color={theme.border}>{'─'.repeat(60)}</Text>
      </Box>
    </Box>
  );
}

function MessageDisplay({ messages }: { messages: ChatMessage[] }) {
  // Show last 20 messages
  const visible = messages.slice(-20);
  return (
    <Box flexDirection="column" flexGrow={1}>
      {visible.map((msg, i) => (
        <Box key={i} marginBottom={0} flexDirection="row">
          {msg.role === 'user' && (
            <Box>
              <Text color={theme.info} bold>{'> '}</Text>
              <Text color={theme.text}>{msg.content}</Text>
            </Box>
          )}
          {msg.role === 'assistant' && (
            <Box>
              <Text color={theme.primary} bold>{'🍪 '}</Text>
              <Text color={theme.text}>{msg.content}</Text>
            </Box>
          )}
          {msg.role === 'status' && (
            <Box>
              <Text color={theme.textDim} italic>{'   '}{msg.content}</Text>
            </Box>
          )}
        </Box>
      ))}
    </Box>
  );
}

function StreamingIndicator({ text }: { text: string }) {
  return (
    <Box>
      <Text color={theme.primary} bold>{'🍪 '}</Text>
      <Text color={theme.text}>{text}</Text>
      <Text color={theme.primary}>{'█'}</Text>
    </Box>
  );
}

function StatusBar({ provider, model, mode }: { provider: string; model: string; mode: string }) {
  return (
    <Box marginTop={1}>
      <Text color={theme.border}>{'─'.repeat(60)}</Text>
    </Box>
  );
}

function CookieApp({ agent }: AppProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState('');
  const [statusText, setStatusText] = useState('');
  const { exit } = useApp();

  // Add startup message
  useEffect(() => {
    const startupQuip = agent.getPersonality().quip('startup');
    if (startupQuip) {
      setMessages([{ role: 'assistant', content: startupQuip, timestamp: Date.now() }]);
    }
  }, []);

  // Set up streaming callback
  useEffect(() => {
    agent.onStream = (chunk: StreamChunk) => {
      if (chunk.type === 'token' && chunk.content) {
        setStreamBuffer(prev => prev + chunk.content!);
      }
      if (chunk.type === 'tool_call' && chunk.toolCall) {
        setStatusText(`🔧 Calling: ${chunk.toolCall.function.name}`);
      }
      if (chunk.type === 'done') {
        // Stream complete
      }
    };

    agent.onStatus = (status: string) => {
      setStatusText(status);
    };

    agent.onConfirm = async (message: string): Promise<boolean> => {
      setMessages(prev => [...prev, {
        role: 'status',
        content: `⚠️ CONFIRMATION REQUIRED:\n${message}\n(Type 'yes' to confirm, anything else to deny)`,
        timestamp: Date.now()
      }]);
      // For now, auto-deny. In production, this would wait for user input.
      return false;
    };
  }, [agent]);

  const handleSubmit = useCallback(async (value: string) => {
    if (!value.trim() || isProcessing) return;

    const trimmed = value.trim();

    // Handle special commands
    if (trimmed === '/exit' || trimmed === '/quit') {
      await agent.shutdown();
      exit();
      return;
    }

    if (trimmed === '/clear') {
      setMessages([]);
      return;
    }

    if (trimmed === '/help') {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Available commands:
  /exit, /quit  — Exit Cookie
  /clear        — Clear chat history
  /provider <n> — Switch LLM provider
  /model <n>    — Switch model
  /mode <n>     — Switch mode (chat/autonomous/plan)
  /help         — Show this help`,
        timestamp: Date.now()
      }]);
      setInput('');
      return;
    }

    if (trimmed.startsWith('/provider ')) {
      const name = trimmed.slice(10).trim();
      try {
        agent.setProvider(name);
        setMessages(prev => [...prev, { role: 'status', content: `Switched to provider: ${name}`, timestamp: Date.now() }]);
      } catch (e) {
        setMessages(prev => [...prev, { role: 'status', content: `Error: ${(e as Error).message}`, timestamp: Date.now() }]);
      }
      setInput('');
      return;
    }

    if (trimmed.startsWith('/model ')) {
      const name = trimmed.slice(7).trim();
      agent.setModel(name);
      setMessages(prev => [...prev, { role: 'status', content: `Switched to model: ${name}`, timestamp: Date.now() }]);
      setInput('');
      return;
    }

    // Regular message
    setMessages(prev => [...prev, { role: 'user', content: trimmed, timestamp: Date.now() }]);
    setInput('');
    setIsProcessing(true);
    setStreamBuffer('');
    setStatusText('');

    try {
      const response = await agent.chat(trimmed);
      setMessages(prev => [...prev, { role: 'assistant', content: response, timestamp: Date.now() }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'status', content: `Error: ${(err as Error).message}`, timestamp: Date.now() }]);
    }

    setIsProcessing(false);
    setStreamBuffer('');
    setStatusText('');
  }, [agent, isProcessing, exit]);

  // Handle Ctrl+C
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      agent.shutdown();
      exit();
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Header />
      <MessageDisplay messages={messages} />
      
      {isProcessing && streamBuffer && (
        <StreamingIndicator text={streamBuffer} />
      )}

      {isProcessing && statusText && (
        <Box>
          <Text color={theme.textDim} italic>{'   '}{statusText}</Text>
        </Box>
      )}

      <Box marginTop={1}>
        {isProcessing ? (
          <Box>
            <Text color={theme.primary}>
              <Spinner type="dots" />
            </Text>
            <Text color={theme.textDim}> Thinking...</Text>
          </Box>
        ) : (
          <Box>
            <Text color={theme.accent} bold>{'❯ '}</Text>
            <TextInput
              value={input}
              onChange={setInput}
              onSubmit={handleSubmit}
              placeholder="Ask Cookie anything..."
            />
          </Box>
        )}
      </Box>
    </Box>
  );
}

export function startUI(agent: CookieAgent): void {
  render(React.createElement(CookieApp, { agent }));
}
