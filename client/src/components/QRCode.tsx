import { useEffect, useRef, useState } from "react";
import QRCodeLib from "qrcode";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QRCodeProps {
  url: string;
  size?: number;
  className?: string;
  showDownload?: boolean;
}

export function QRCode({ url, size = 200, className = "", showDownload = true }: QRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (canvasRef.current) {
      QRCodeLib.toCanvas(
        canvasRef.current,
        url,
        {
          width: size,
          margin: 2,
          color: {
            dark: "#918EF4",
            light: "#FFFFFF",
          },
        },
        (err) => {
          if (err) {
            setError("Failed to generate QR code");
            console.error(err);
          }
        }
      );
    }
  }, [url, size]);

  const handleDownload = () => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const link = document.createElement("a");
      link.download = "dime-time-qr-code.png";
      link.href = canvas.toDataURL();
      link.click();
    }
  };

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <div className={`inline-flex flex-col items-center gap-3 ${className}`}>
      <canvas
        ref={canvasRef}
        className="border-4 border-white rounded-lg shadow-lg bg-white"
        data-testid="qr-code-canvas"
      />
      {showDownload && (
        <Button
          onClick={handleDownload}
          variant="outline"
          size="sm"
          className="bg-white text-[#918EF4] hover:bg-[#918EF4] hover:text-white border-2 border-white"
          data-testid="button-download-qr"
        >
          <Download className="w-4 h-4 mr-2" />
          Download QR Code
        </Button>
      )}
    </div>
  );
}
