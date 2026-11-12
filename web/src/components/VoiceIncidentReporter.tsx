import { useState, useRef, useEffect, type ChangeEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { voiceApi, getErrorMessage } from "../services/api";
import type { IncidentCategory, Severity } from "../types/api";
import Button from "./common/Button";

interface VoiceIncidentReporterProps {
  onTranscriptionApplied: (data: {
    title: string;
    description: string;
    severity: Severity;
    category: IncidentCategory;
    address?: string;
    location?: { type: "Point"; coordinates: [number, number] };
    contactPhone?: string;
    tags?: string;
  }) => void;
}

export const VoiceIncidentReporter = ({ onTranscriptionApplied }: VoiceIncidentReporterProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcriptResult, setTranscriptResult] = useState<any | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [audioUrl]);

  const startRecording = async () => {
    setPermissionError(null);
    setAudioBlob(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setTranscriptResult(null);
    audioChunksRef.current = [];

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Microphone recording is not supported in this browser.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = window.setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      toast.success("Recording started...");
    } catch (err: any) {
      let msg = "Microphone access denied or unavailable.";
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        msg = "Microphone permission was denied. Please allow microphone access in your browser settings.";
      } else if (err.message) {
        msg = err.message;
      }
      setPermissionError(msg);
      toast.error(msg);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      toast.success("Recording stopped.");
    }
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["audio/webm", "audio/mp4", "audio/mpeg", "audio/wav", "audio/ogg", "video/webm"];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(webm|mp4|mp3|wav|ogg)$/i)) {
      toast.error("Unsupported audio format. Please provide WebM, MP4, MP3, WAV, or OGG.");
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      toast.error("Audio file exceeds 25MB limit.");
      return;
    }

    setAudioBlob(file);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(URL.createObjectURL(file));
    setTranscriptResult(null);
    setPermissionError(null);
    toast.success("Audio file loaded successfully.");
    e.target.value = "";
  };

  const transcribeMutation = useMutation({
    mutationFn: async () => {
      if (!audioBlob) throw new Error("No audio recording or file available.");
      const file = new File([audioBlob], `voice-report-${Date.now()}.webm`, { type: audioBlob.type || "audio/webm" });
      return voiceApi.transcribe(file);
    },
    onSuccess: (data) => {
      setTranscriptResult(data);
      toast.success("Voice report successfully transcribed and parsed!");
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, "Failed to transcribe audio."));
    },
  });

  const applyToForm = () => {
    if (!transcriptResult) return;
    onTranscriptionApplied({
      title: transcriptResult.title || "Voice Reported Emergency Incident",
      description: transcriptResult.description || transcriptResult.transcript || "",
      severity: (transcriptResult.severity as Severity) || "HIGH",
      category: (transcriptResult.category as IncidentCategory) || "OTHER",
      address: transcriptResult.address || "",
      location: transcriptResult.location || { type: "Point", coordinates: [77.209, 28.6139] },
      contactPhone: transcriptResult.contactPhone || "",
      tags: (transcriptResult.emergencyRequirements || []).join(", "),
    });
    toast.success("Fields populated into incident form! Review and submit.");
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div className="rounded-xl border border-cyber-cyan/30 bg-tactical-900/90 p-5 shadow-glass space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-cyber-cyan animate-pulse" />
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-cyber-cyan">
            AI Voice-Based Incident Reporting
          </h3>
        </div>
        <span className="text-xs font-mono text-platinum-700">Speech-to-Incident</span>
      </div>

      <p className="text-xs text-platinum-700">
        Record an emergency voice description or upload an audio file. AI will transcribe the audio, extract key emergency details, and fill in the form for your review.
      </p>

      {permissionError && (
        <div className="rounded border border-alert-red/30 bg-alert-red/10 p-3 text-xs text-alert-red" role="alert">
          {permissionError}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {!isRecording ? (
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={startRecording}
            icon={<span>🎙️</span>}
          >
            Start Recording
          </Button>
        ) : (
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={stopRecording}
            icon={<span className="animate-pulse">⏹️</span>}
          >
            Stop Recording ({formatTime(recordingTime)})
          </Button>
        )}

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          icon={<span>📁</span>}
        >
          Upload Audio File
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,video/webm"
          className="hidden"
          onChange={handleFileUpload}
        />
      </div>

      {audioUrl && (
        <div className="space-y-2 rounded-lg border border-platinum-800 bg-tactical-950 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-platinum-700">Audio Preview</span>
            <button
              type="button"
              onClick={() => {
                setAudioBlob(null);
                setAudioUrl(null);
                setTranscriptResult(null);
              }}
              className="text-xs text-alert-red hover:underline"
            >
              Discard audio
            </button>
          </div>
          <audio src={audioUrl} controls className="w-full h-10" />

          <div className="pt-2 flex justify-end">
            <Button
              type="button"
              size="sm"
              onClick={() => transcribeMutation.mutate()}
              isLoading={transcribeMutation.isPending}
            >
              {transcribeMutation.isPending ? "Transcribing & Extracting..." : "Transcribe with AI"}
            </Button>
          </div>
        </div>
      )}

      {transcriptResult && (
        <div className="space-y-3 rounded-lg border border-safe-green/40 bg-safe-green/10 p-4 text-platinum-900">
          <div className="flex items-center justify-between">
            <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-safe-green">
              Transcription & Extracted Details
            </h4>
            <span className="text-xs font-mono text-platinum-800">Ready to populate</span>
          </div>

          <div className="space-y-1 text-xs font-mono text-platinum-800">
            <p><strong>Transcript:</strong> {transcriptResult.transcript}</p>
            <p><strong>Suggested Title:</strong> {transcriptResult.title}</p>
            <p><strong>Category:</strong> {transcriptResult.category} | <strong>Severity:</strong> {transcriptResult.severity}</p>
            {transcriptResult.address && <p><strong>Address:</strong> {transcriptResult.address}</p>}
            {transcriptResult.contactPhone && <p><strong>Phone:</strong> {transcriptResult.contactPhone}</p>}
            {transcriptResult.emergencyRequirements && (
              <p><strong>Requirements:</strong> {transcriptResult.emergencyRequirements.join(", ")}</p>
            )}
          </div>

          <div className="pt-2 flex justify-end">
            <Button type="button" variant="success" size="sm" onClick={applyToForm}>
              Populate Incident Form
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
