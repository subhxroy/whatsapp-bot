'use client';

import { FileImage, ShieldAlert, CheckCircle } from 'lucide-react';

export default function MediaPage() {
  return (
    <div className="space-y-8 text-[#070607]">
      <div>
        <h1 className="font-display text-5xl uppercase tracking-tight text-[#070607]">
          MEDIA PROCESSING SETTINGS
        </h1>
        <p className="text-sm font-medium text-[#070607]/70 mt-1">
          FFmpeg conversion parameters, size limits, and privacy policies
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="rounded-[40px] bg-[#f7f6f2] p-8 space-y-6 text-[#070607]">
          <div className="flex items-center gap-3">
            <FileImage className="h-7 w-7 text-[#fc5000]" />
            <h2 className="font-display text-3xl uppercase text-[#070607]">Sticker & Image Engine</h2>
          </div>
          <p className="text-sm font-medium text-[#070607]/80">
            Converts static images and animated MP4/GIF videos into 512x512 WhatsApp WebP stickers using FFmpeg binaries.
          </p>

          <div className="space-y-3 pt-2 text-sm font-medium text-[#070607]">
            <div className="flex justify-between py-2 border-b border-dotted border-[#070607]/20">
              <span className="text-[#070607]/70">Max Upload Limit</span>
              <span className="font-bold text-[#070607]">50 MB (Default)</span>
            </div>
            <div className="flex justify-between py-2 border-b border-dotted border-[#070607]/20">
              <span className="text-[#070607]/70">Temp File Lifecycle</span>
              <span className="font-bold text-[#fc5000]">Guaranteed Unlink (<code className="text-xs">finally</code> block)</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-[#070607]/70">Supported Formats</span>
              <span className="font-bold text-[#070607]">PNG, JPG, MP4, WebP, GIF</span>
            </div>
          </div>
        </div>

        <div className="rounded-[40px] bg-[#f7f6f2] p-8 space-y-6 text-[#070607]">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-7 w-7 text-[#fc5000]" />
            <h2 className="font-display text-3xl uppercase text-[#070607]">View-Once Policy</h2>
          </div>
          <p className="text-sm font-medium text-[#070607]/80">
            Media processing commands (<code className="bg-[#f5f28e] px-1.5 py-0.5 rounded text-xs">.sticker</code>, <code className="bg-[#f5f28e] px-1.5 py-0.5 rounded text-xs">.toimg</code>) reject view-once payloads. Replying to a view-once image, video, or audio with <code className="bg-[#f5f28e] px-1.5 py-0.5 rounded text-xs">.vv</code> / <code className="bg-[#f5f28e] px-1.5 py-0.5 rounded text-xs">.avv</code> reveals it as normal media.
          </p>

          <div className="rounded-[24px] bg-[#f5f28e] p-5 flex items-center gap-3 text-sm font-bold text-[#070607]">
            <CheckCircle className="h-6 w-6 text-[#070607] flex-shrink-0" />
            <span>Sender privacy respected by default; explicit reveal via .vv / .avv</span>
          </div>
        </div>
      </div>
    </div>
  );
}
