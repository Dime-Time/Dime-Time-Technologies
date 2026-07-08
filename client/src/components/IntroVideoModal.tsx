import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Play, Pause, Volume2, VolumeX } from "lucide-react";
import introVideo from "@assets/Using_918ef4_as_202508312147_1757083629199.mp4";

interface IntroVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function IntroVideoModal({ isOpen, onClose }: IntroVideoModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(false);

  useEffect(() => {
    if (isOpen && videoRef.current) {
      // Auto-play when modal opens
      videoRef.current.play().catch(console.error);
      setIsPlaying(true);
    }
  }, [isOpen]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVideoEnd = () => {
    setIsPlaying(false);
    // Auto-close modal after 2 seconds when video ends
    setTimeout(() => {
      onClose();
    }, 2000);
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-4xl w-full p-0 bg-black border-none overflow-hidden shadow-card animate-fade-in"
      >
        <DialogTitle className="sr-only">Dime Time Welcome Video</DialogTitle>
        <DialogDescription className="sr-only">
          Welcome introduction video for new Dime Time users explaining how to get out of debt one dime at a time
        </DialogDescription>
        <div className="relative group">
          {/* Close Button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 z-50 bg-black/40 hover:bg-black/80 text-white rounded-full w-10 h-10 transition-colors border border-white/10"
            onClick={onClose}
            data-testid="close-intro-video"
          >
            <X className="h-5 w-5" />
          </Button>

          {/* Skip Button */}
          <Button
            variant="ghost"
            className="absolute top-4 left-4 z-50 bg-black/40 hover:bg-black/80 text-white rounded-full px-4 h-10 transition-colors border border-white/10 text-sm font-medium press-scale"
            onClick={handleSkip}
            data-testid="skip-intro-video"
          >
            Skip Intro
          </Button>

          {/* Video Container */}
          <div 
            className="relative w-full aspect-video bg-slate-900 rounded-xl overflow-hidden cursor-pointer"
            onMouseEnter={() => setShowControls(true)}
            onMouseLeave={() => setShowControls(false)}
            onClick={togglePlay}
          >
            <video
              ref={videoRef}
              src={introVideo}
              className="w-full h-full object-cover"
              onEnded={handleVideoEnd}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              playsInline
              data-testid="intro-video-player"
            />

            {/* Video Controls Overlay */}
            <div 
              className={`absolute inset-0 bg-black/30 transition-opacity duration-300 ${
                showControls || !isPlaying ? 'opacity-100' : 'opacity-0'
              }`}
            >
              {/* Center Play/Pause Button */}
              {!isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center animate-fade-in-up">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="bg-dime-purple hover:bg-dime-accent text-white rounded-full w-20 h-20 shadow-lg border-4 border-white/20 transition-all hover:scale-105"
                    onClick={togglePlay}
                    data-testid="play-pause-button"
                  >
                    <Play className="h-8 w-8 ml-1" />
                  </Button>
                </div>
              )}

              {/* Bottom Controls */}
              <div className="absolute bottom-6 right-6 flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="bg-black/50 hover:bg-black/80 text-white rounded-full w-12 h-12 backdrop-blur-sm border border-white/10 transition-colors press-scale"
                  onClick={togglePlay}
                  data-testid="control-play-pause"
                >
                  {isPlaying ? (
                    <Pause className="h-5 w-5" />
                  ) : (
                    <Play className="h-5 w-5 ml-1" />
                  )}
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="bg-black/50 hover:bg-black/80 text-white rounded-full w-12 h-12 backdrop-blur-sm border border-white/10 transition-colors press-scale"
                  onClick={toggleMute}
                  data-testid="mute-button"
                >
                  {isMuted ? (
                    <VolumeX className="h-5 w-5" />
                  ) : (
                    <Volume2 className="h-5 w-5" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Welcome Message Overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-8 pt-20 pointer-events-none">
            <div className="text-white max-w-2xl">
              <h2 className="text-3xl font-bold mb-3 text-white">Welcome to Dime Time!</h2>
              <p className="text-slate-200 text-lg leading-relaxed font-medium">
                Get ready to transform your spare change into debt freedom, one dime at a time.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}