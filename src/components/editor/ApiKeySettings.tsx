'use client';

import { useEffect, useState } from 'react';
import { Check, ChevronDown, Eye, EyeOff, Loader2, Settings, Shield } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { fetchAvailableModels, getSelectedModel, setSelectedModel } from '@/lib/video/ai/template-ai';

export function ApiKeySettings() {
  const [open, setOpen] = useState(false);
  const [loadingModels, setLoadingModels] = useState(true);
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModelLocal] = useState(getSelectedModel());
  const [deepseekKey, setDeepseekKeyLocal] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [keyStatus, setKeyStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const [deepgramKey, setDeepgramKey] = useState('');
  const [elevenlabsKey, setElevenlabsKey] = useState('');
  const [cartesiaKey, setCartesiaKey] = useState('');
  const [ttsStatus, setTtsStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    const savedModel = getSelectedModel();
    setSelectedModelLocal(savedModel);
    void handleFetchModels();
  }, []);

  const handleFetchModels = async () => {
    setLoadingModels(true);
    try {
      const fetchedModels = await fetchAvailableModels();
      setModels(fetchedModels);
    } catch (error) {
      console.error('Failed to fetch models:', error);
    } finally {
      setLoadingModels(false);
    }
  };

  const handleModelSelect = (model: string) => {
    setSelectedModelLocal(model);
    setSelectedModel(model);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSaveKey = async () => {
    setKeyStatus('saving');
    try {
      const res = await fetch('/api/user/set-api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'deepseek', apiKey: deepseekKey.trim() }),
      });
      if (!res.ok) throw new Error();
      setKeyStatus('saved');
      setTimeout(() => setKeyStatus('idle'), 2000);
    } catch {
      setKeyStatus('error');
      setTimeout(() => setKeyStatus('idle'), 3000);
    }
  };

  const handleSaveTtsKeys = async () => {
    setTtsStatus('saving');
    try {
      await Promise.all([
        deepgramKey.trim() && fetch('/api/user/set-api-key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: 'deepgram', apiKey: deepgramKey.trim() }) }),
        elevenlabsKey.trim() && fetch('/api/user/set-api-key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: 'elevenlabs', apiKey: elevenlabsKey.trim() }) }),
        cartesiaKey.trim() && fetch('/api/user/set-api-key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: 'cartesia', apiKey: cartesiaKey.trim() }) }),
      ]);
      setTtsStatus('saved');
      setTimeout(() => setTtsStatus('idle'), 2000);
    } catch {
      setTtsStatus('error');
      setTimeout(() => setTtsStatus('idle'), 3000);
    }
  };

  const isDeepSeek = selectedModel.startsWith('deepseek');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-gray-400 hover:text-slate-900 dark:text-white h-8">
          <Settings className="w-4 h-4 mr-2" />
          AI Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-gray-900 border-gray-700 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="w-5 h-5" />
            AI Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-gray-400 text-sm">
            AI requests now run through secure server-side providers. Browser requests only send prompt data, not provider tokens.
          </p>

          <div className="space-y-2">
            <Label className="text-gray-300">Select Model</Label>

            {loadingModels ? (
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading models...
              </div>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between bg-gray-800 border-gray-700 text-slate-900 dark:text-white"
                  >
                    {selectedModel}
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-full bg-gray-800 border-gray-700 max-h-60 overflow-y-auto">
                  {models.map((model) => (
                    <DropdownMenuItem
                      key={model}
                      onClick={() => handleModelSelect(model)}
                      className="text-slate-900 dark:text-white hover:bg-gray-700 cursor-pointer"
                    >
                      {model}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <div className="text-xs text-green-400 flex items-center gap-1">
              <Check className="w-3 h-3" />
              Using: {selectedModel}
            </div>
            <div className="text-xs text-gray-500">
              Available models come from your server configuration.
            </div>
          </div>

          {isDeepSeek && (
            <div className="space-y-2">
              <Label className="text-gray-300">DeepSeek API Key</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={deepseekKey}
                    onChange={e => setDeepseekKeyLocal(e.target.value)}
                    placeholder="sk-..."
                    className="w-full bg-gray-800 border border-gray-700 text-slate-900 dark:text-white text-sm rounded-md px-3 py-2 pr-9 focus:outline-none focus:border-purple-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(v => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <Button size="sm" onClick={handleSaveKey} disabled={keyStatus === 'saving'} className="bg-purple-600 hover:bg-purple-500 text-slate-900 dark:text-white">
                  {keyStatus === 'saving' ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                </Button>
              </div>
              <div className="text-xs text-gray-500">
                Get your key at <span className="text-purple-400">platform.deepseek.com</span>. Stored as secure HTTP-only cookie.
              </div>
              {keyStatus === 'saved' && (
                <div className="text-xs text-green-400 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Key saved securely
                </div>
              )}
              {keyStatus === 'error' && (
                <div className="text-xs text-red-400">Failed to save key. Try again.</div>
              )}
            </div>
          )}

          {saved && (
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <Check className="w-4 h-4" />
              Model saved!
            </div>
          )}

          <div className="space-y-3 pt-2 border-t border-gray-700">
            <Label className="text-gray-300 text-sm font-medium">Voice (TTS) API Keys</Label>
            <p className="text-xs text-gray-500">Enter your own keys to override the defaults. Leave blank to use shared keys.</p>

            {[
              { label: 'Deepgram', value: deepgramKey, setter: setDeepgramKey, placeholder: 'deepgram-api-key...', link: 'deepgram.com/console' },
              { label: 'ElevenLabs', value: elevenlabsKey, setter: setElevenlabsKey, placeholder: 'sk_...', link: 'elevenlabs.io' },
              { label: 'Cartesia', value: cartesiaKey, setter: setCartesiaKey, placeholder: 'sk_car_...', link: 'cartesia.ai' },
            ].map(({ label, value, setter, placeholder, link }) => (
              <div key={label} className="space-y-1">
                <Label className="text-gray-400 text-xs">{label}</Label>
                <input
                  type="password"
                  value={value}
                  onChange={e => setter(e.target.value)}
                  placeholder={placeholder}
                  className="w-full bg-gray-800 border border-gray-700 text-slate-900 dark:text-white text-sm rounded-md px-3 py-2 focus:outline-none focus:border-purple-500"
                />
                <p className="text-xs text-gray-600">{link}</p>
              </div>
            ))}

            <Button size="sm" onClick={handleSaveTtsKeys} disabled={ttsStatus === 'saving'} className="bg-purple-600 hover:bg-purple-500 text-slate-900 dark:text-white w-full">
              {ttsStatus === 'saving' ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : null}
              Save Voice Keys
            </Button>
            {ttsStatus === 'saved' && <p className="text-xs text-green-400 flex items-center gap-1"><Check className="w-3 h-3" /> Keys saved</p>}
            {ttsStatus === 'error' && <p className="text-xs text-red-400">Failed to save. Try again.</p>}
          </div>

          <div className="text-xs text-gray-500 pt-2">
            In production, HTTPS encrypts traffic in transit, and provider keys stay on the server.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
