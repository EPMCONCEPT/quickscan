import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Camera, RefreshCw, XCircle, AlertCircle } from 'lucide-react';

interface ScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
}

export default function Scanner({ onScanSuccess, onClose }: ScannerProps) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const [scanError, setScanError] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  useEffect(() => {
    // Avoid double initialization by releasing active instance if any
    const setupScanner = async () => {
      try {
        setIsInitializing(true);
        // Create an instance of Html5QrcodeScanner
        const scanner = new Html5QrcodeScanner(
          'qr-reader-target',
          {
            fps: 15,
            qrbox: { width: 220, height: 220 },
            aspectRatio: 1.0,
            showTorchButtonIfSupported: true,
            rememberLastUsedCamera: true,
          },
          /* verbose= */ false
        );

        scannerRef.current = scanner;

        // Start scanning with success and error callback
        scanner.render(
          (decodedText) => {
            // Found a QR Code
            if (scannerRef.current) {
              scannerRef.current.clear().then(() => {
                onScanSuccess(decodedText);
              }).catch(err => {
                console.error("Scanner clear error", err);
                onScanSuccess(decodedText); // Proceed anyway on success
              });
            } else {
              onScanSuccess(decodedText);
            }
          },
          (errorMessage) => {
            // Silent error logs since it's scanning 15 frames per second
            // console.log("Scanning...", errorMessage);
          }
        );
        
        setIsInitializing(false);
      } catch (err: any) {
        console.error("Camera scan start failure:", err);
        setScanError("Failed to access your device's camera. Ensure you have granted camera permissions to this frame, or type in the check-in code manually below.");
        setIsInitializing(false);
      }
    };

    // Deliberate slight offset to guarantee DOM is fully populated before mounting bindings
    const timer = setTimeout(() => {
      setupScanner();
    }, 150);

    return () => {
      clearTimeout(timer);
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => {
          console.warn("Scanner shutdown did not complete fully:", err);
        });
      }
    };
  }, [onScanSuccess]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 w-full max-w-sm mx-auto shadow-2xl relative">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
        <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Camera className="w-4 h-4 text-emerald-400 animate-pulse" />
          Camera Viewfinder
        </h2>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-red-400 transition"
          title="Close scanner"
        >
          <XCircle className="w-5 h-5" />
        </button>
      </div>

      {scanError ? (
        <div className="bg-red-500/10 border border-red-500/20 text-red-300 p-3 rounded-xl text-xs flex gap-2 leading-relaxed">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Camera Access Refused</p>
            <p className="mt-1">{scanError}</p>
          </div>
        </div>
      ) : (
        <div className="relative">
          {/* Scanning overlays */}
          {isInitializing && (
            <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center rounded-xl z-20 gap-3 border border-slate-800">
              <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
              <p className="text-xs text-slate-400 font-medium">Binds camera stream...</p>
            </div>
          )}

          {/* Viewfinder Corner Highlights */}
          <div className="absolute inset-x-0 inset-y-0 pointer-events-none z-10 p-2">
            <div className="w-full h-full relative">
              {/* Corner Border Highlights (Aesthetic) */}
              <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-emerald-400 rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-emerald-400 rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-emerald-400 rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-emerald-400 rounded-br-lg" />
              
              {/* Floating scanner red line */}
              <div className="absolute left-4 right-4 h-[1px] bg-red-500/70 shadow-[0_0_8px_rgba(239,68,68,0.8)] top-1/2 -translate-y-1/2 animate-bounce uppercase text-[8px] font-mono tracking-widest text-red-400 font-bold block text-center" />
            </div>
          </div>

          {/* Dynamic HTML5-QR Code Reader container Target */}
          <div className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
            <div id="qr-reader-target" className="w-full text-slate-400 text-xs text-center" />
          </div>

          <p className="text-center text-[10px] text-slate-500 mt-3 font-medium">
            Align the TV/Teacher QR Code bracket center to verify attendance automatically
          </p>
        </div>
      )}

      {/* Aesthetic adjustments for standard html5-qrcode buttons override inside iframe */}
      <style>{`
        #qr-reader-target button {
          background-color: rgb(15 23 42) !important;
          border: 1px solid rgb(51 65 85) !important;
          color: rgb(226 232 240) !important;
          padding: 6px 12px !important;
          border-radius: 8px !important;
          font-size: 11px !important;
          cursor: pointer !important;
          font-weight: 500 !important;
          transition: all 0.2s !important;
          margin-top: 10px !important;
        }
        #qr-reader-target button:hover {
          background-color: rgb(30 41 59) !important;
          border-color: rgb(16 185 129) !important;
          color: rgb(16 185 129) !important;
        }
        #qr-reader-target img {
          display: none !important;
        }
        #qr-reader-target__dashboard {
          padding: 8px !important;
          border-top: none !important;
          background-color: transparent !important;
        }
      `}</style>
    </div>
  );
}
