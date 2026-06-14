import React, { useState, useEffect, useRef } from 'react';
import { Camera, Sliders, Settings, Award, Compass, Heart, Info, Smile, Frown, Flame, Zap, Trash2 } from 'lucide-react';

export default function EmotionAdaptiveApp() {
  const [mode, setMode] = useState('reflection'); // 'reflection' or 'rectification'
  const [controlSource, setControlSource] = useState('live'); // 'live' or 'manual' (simulated removed)
  const [modelStatus, setModelStatus] = useState('not-loaded'); // 'not-loaded', 'loading', 'ready', 'failed'
  
  // Real-time emotion composition
  const [emotions, setEmotions] = useState({
    neutral: 100,
    happy: 0,
    sad: 0,
    anger: 0,
    surprise: 0
  });

  // Facial warping metrics
  const [warpMetrics, setWarpMetrics] = useState({
    eyebrowLift: 0, 
    smileIntensity: 0, 
    mouthOpenness: 0, 
    eyeSquint: 0 
  });

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [inputText, setInputText] = useState('');
  const [journalEntries, setJournalEntries] = useState([]);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Load face-api when live mode is active
  useEffect(() => {
    if (controlSource === 'live' && modelStatus === 'not-loaded') {
      loadFaceApi();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlSource, modelStatus]);

  const loadFaceApi = async () => {
    setModelStatus('loading');
    let checkInterval = setInterval(async () => {
      if (window.faceapi) {
        clearInterval(checkInterval);
        try {
          const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models/';
          await window.faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
          await window.faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
          await window.faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
          setModelStatus('ready');
          setIsCameraActive(true);
        } catch (err) {
          console.error("Error loading face-api models: ", err);
          setModelStatus('failed');
        }
      }
    }, 200);

    setTimeout(() => {
      clearInterval(checkInterval);
      if (modelStatus === 'loading') {
        setModelStatus('failed');
      }
    }, 10000);
  };

  // Camera Stream setup
  useEffect(() => {
    if (controlSource === 'live' && isCameraActive && modelStatus === 'ready') {
      navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } })
        .then(stream => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
          }
        })
        .catch(err => {
          console.error("Camera access blocked: ", err);
          setIsCameraActive(false);
          setControlSource('manual');
        });
    } else {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    }
  }, [isCameraActive, controlSource, modelStatus]);

  // Live face detection loop
  useEffect(() => {
    let active = true;
    let animFrame;

    const runDetect = async () => {
      if (!active) return;
      
      if (controlSource === 'live' && isCameraActive && modelStatus === 'ready' && videoRef.current) {
        const video = videoRef.current;
        if (video.readyState === 4 && !video.paused) {
          try {
            const options = new window.faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.35 });
            const detection = await window.faceapi.detectSingleFace(video, options)
              .withFaceLandmarks()
              .withFaceExpressions();

            if (detection && active) {
              const exp = detection.expressions;
              const totalExp = (exp.neutral + exp.happy + exp.sad + exp.angry + exp.surprised) || 1;
              
              setEmotions({
                neutral: Math.round((exp.neutral / totalExp) * 100),
                happy: Math.round((exp.happy / totalExp) * 100),
                sad: Math.round((exp.sad / totalExp) * 100),
                anger: Math.round((exp.angry / totalExp) * 100),
                surprise: Math.round((exp.surprised / totalExp) * 100),
              });

              const landmarks = detection.landmarks;
              const mouth = landmarks.getMouth();
              const leftEyebrow = landmarks.getLeftEyeBrow();
              const rightEyebrow = landmarks.getRightEyeBrow();
              const leftEye = landmarks.getLeftEye();
              const rightEye = landmarks.getRightEye();

              const mouthTop = mouth[14];
              const mouthBottom = mouth[18];
              const mouthHeight = Math.hypot(mouthTop.x - mouthBottom.x, mouthTop.y - mouthBottom.y);
              const mouthLeft = mouth[0];
              const mouthRight = mouth[6];
              const mouthWidth = Math.hypot(mouthLeft.x - mouthRight.x, mouthLeft.y - mouthRight.y);
              const rawMouthOpenness = mouthHeight / (mouthWidth || 1);
              const mouthOpenness = Math.min(100, Math.max(0, Math.round(rawMouthOpenness * 250)));

              const nose = landmarks.getNose();
              const noseTip = nose[6]; 
              const avgMouthCornerY = (mouth[0].y + mouth[6].y) / 2;
              const smileDeltaY = avgMouthCornerY - noseTip.y; 
              const smileIntensity = Math.min(100, Math.max(0, Math.round((30 - smileDeltaY) * 3.5)));

              const leftEyeY = leftEye.reduce((acc, p) => acc + p.y, 0) / 6;
              const rightEyeY = rightEye.reduce((acc, p) => acc + p.y, 0) / 6;
              const leftEyebrowY = leftEyebrow.reduce((acc, p) => acc + p.y, 0) / 5;
              const rightEyebrowY = rightEyebrow.reduce((acc, p) => acc + p.y, 0) / 5;
              const avgEyebrowDistance = ((leftEyeY - leftEyebrowY) + (rightEyeY - rightEyebrowY)) / 2;
              const eyebrowLift = Math.min(100, Math.max(0, Math.round((avgEyebrowDistance - 18) * 4.5)));

              const leftEyeHeight = Math.hypot(leftEye[1].x - leftEye[5].x, leftEye[1].y - leftEye[5].y);
              const rightEyeHeight = Math.hypot(rightEye[1].x - rightEye[5].x, rightEye[1].y - rightEye[5].y);
              const avgEyeHeight = (leftEyeHeight + rightEyeHeight) / 2;
              const eyeSquint = Math.min(100, Math.max(0, Math.round((14 - avgEyeHeight) * 9)));

              setWarpMetrics({
                eyebrowLift,
                smileIntensity,
                mouthOpenness,
                eyeSquint
              });

              if (canvasRef.current) {
                const canvas = canvasRef.current;
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
                landmarks.positions.forEach((pt) => {
                  ctx.beginPath();
                  ctx.arc(pt.x, pt.y, 2, 0, 2 * Math.PI);
                  ctx.fill();
                });

                const box = detection.detection.box;
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
                ctx.lineWidth = 2;
                ctx.strokeRect(box.x, box.y, box.width, box.height);
              }
            }
          } catch (e) {
            console.error("Detection error: ", e);
          }
        }
      }

      if (active && controlSource === 'live' && isCameraActive) {
        animFrame = requestAnimationFrame(runDetect);
      }
    };

    if (controlSource === 'live' && isCameraActive && modelStatus === 'ready') {
      const startTimer = setTimeout(runDetect, 500);
      return () => {
        active = false;
        clearTimeout(startTimer);
        if (animFrame) cancelAnimationFrame(animFrame);
      };
    }
  }, [controlSource, isCameraActive, modelStatus]);

  // Handle manual adjustments
  const handleManualEmotionChange = (key, val) => {
    const newVal = parseInt(val);
    setEmotions(prev => {
      const updated = { ...prev, [key]: newVal };
      const sumOthers = Object.entries(updated)
        .filter(([k]) => k !== key)
        .reduce((sum, [_, v]) => sum + v, 0) || 1;
      
      const targetSum = 100 - newVal;
      const factor = targetSum / sumOthers;

      const result = {};
      Object.keys(updated).forEach(k => {
        if (k === key) {
          result[k] = newVal;
        } else {
          result[k] = Math.max(0, Math.round(updated[k] * factor));
        }
      });
      return result;
    });
  };

  const handleManualWarpChange = (key, val) => {
    setWarpMetrics(prev => ({
      ...prev,
      [key]: parseInt(val)
    }));
  };

  // Uplink/Save journal entry action
  const handleSaveEntry = () => {
    if (!inputText.trim()) return;
    const sorted = Object.entries(emotions).sort((a, b) => b[1] - a[1]);
    const dominantMood = sorted[0][0];

    const newEntry = {
      id: Date.now(),
      text: inputText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      mood: dominantMood,
      moodPercentage: sorted[0][1],
      mode: mode,
      themeColor: ui.themeColor,
      warps: { ...warpMetrics }
    };

    setJournalEntries(prev => [newEntry, ...prev]);
    setInputText('');
  };

  const handleDeleteEntry = (id) => {
    setJournalEntries(prev => prev.filter(entry => entry.id !== id));
  };

  // Dynamic UI styling computation based on selected mode + current emotions
  const getAdaptiveDesign = () => {
    const { happy, sad, anger } = emotions;
    
    let themeColor = 'hsl(238, 70%, 60%)'; 
    let themeColorLight = 'hsl(238, 70%, 96%)';
    let appBackground = '#f8fafc'; 
    let borderRadius = '24px'; 
    let letterSpacing = '0.01em';
    let lineSpacing = '1.6';
    let elementScale = '1.0';
    let borderStyle = '1px solid rgba(15, 23, 42, 0.08)';
    let primaryText = '#0f172a';
    let helperText = '#64748b';
    let emotionMood = 'Neutral-Balance';
    let shadowEffect = '0 10px 40px rgba(15, 23, 42, 0.03)';
    
    let shape1Radius = '45% 55% 60% 40% / 50% 45% 55% 50%';
    let shape2Radius = '55% 45% 40% 60% / 40% 55% 45% 60%';
    let shape1Color = 'rgba(99, 102, 241, 0.12)';
    let shape2Color = 'rgba(232, 121, 249, 0.08)';

    let adaptiveMessage = 'Your expressions are currently balanced. The layout conforms to its baseline sophisticated grid.';
    let dynamicTransition = 'all 1.4s cubic-bezier(0.2, 0.8, 0.2, 1)';

    const sorted = Object.entries(emotions).sort((a, b) => b[1] - a[1]);
    const dominant = sorted[0][0];

    if (mode === 'reflection') {
      if (dominant === 'happy') {
        emotionMood = 'Vibrant Sunshine';
        themeColor = `hsl(45, 95%, 48%)`; 
        themeColorLight = 'hsl(50, 100%, 95%)';
        appBackground = '#fffbeb'; 
        borderRadius = `${28 + (happy * 0.4)}px`; 
        letterSpacing = '0.08em'; 
        lineSpacing = '1.8';
        elementScale = '1.06'; 
        shape1Radius = '60% 40% 60% 40% / 60% 40% 60% 40%';
        shape2Radius = '50% 50% 50% 50% / 50% 50% 50% 50%';
        shape1Color = 'rgba(251, 191, 36, 0.25)';
        shape2Color = 'rgba(244, 63, 94, 0.12)';
        shadowEffect = '0 15px 40px rgba(251, 191, 36, 0.1)';
        adaptiveMessage = 'Sunshine reflected. The interface scales up, expands its letter spacing, and curves elements into friendly bubbles.';
      } 
      else if (dominant === 'sad') {
        emotionMood = 'Drooping Rain';
        themeColor = 'hsl(215, 25%, 38%)'; 
        themeColorLight = 'hsl(210, 20%, 93%)';
        appBackground = '#e2e8f0'; 
        borderRadius = `${Math.max(4, 16 - (sad * 0.15))}px`; 
        letterSpacing = '-0.01em';
        lineSpacing = '1.4';
        elementScale = '0.94'; 
        shape1Radius = '25% 75% 20% 80% / 30% 20% 80% 70%';
        shape2Radius = '30% 70% 25% 75% / 20% 30% 70% 80%';
        shape1Color = 'rgba(71, 85, 105, 0.2)';
        shape2Color = 'rgba(148, 163, 184, 0.15)';
        shadowEffect = 'none';
        adaptiveMessage = 'Quiet shadows. Visual scales are minimized, colors cool down to slates, and borders flatten to reflect low energy.';
      }
      else if (dominant === 'anger') {
        emotionMood = 'Volcanic Tension';
        themeColor = `hsl(0, 85%, 45%)`; 
        themeColorLight = 'hsl(0, 100%, 95%)';
        appBackground = '#fee2e2'; 
        borderRadius = `${Math.max(0, 8 - (anger * 0.15))}px`; 
        letterSpacing = '-0.06em'; 
        lineSpacing = '1.15'; 
        elementScale = '0.97';
        borderStyle = '1px solid rgba(239, 68, 68, 0.4)';
        shape1Radius = '0% 100% 0% 100% / 0% 100% 0% 100%'; 
        shape2Radius = '100% 0% 100% 0% / 100% 0% 100% 0%';
        shape1Color = 'rgba(239, 68, 68, 0.25)';
        shape2Color = 'rgba(249, 115, 22, 0.2)';
        shadowEffect = '0 4px 10px rgba(220, 38, 38, 0.15)';
        dynamicTransition = 'all 0.2s cubic-bezier(1, 0, 0, 1)'; 
        adaptiveMessage = 'HIGH ALERT: Visual parameters are set to immediate, sharp shapes and tight text to echo anger frequencies.';
      }
      else if (dominant === 'surprise') {
        emotionMood = 'Sudden Electric';
        themeColor = 'hsl(285, 90%, 55%)'; 
        themeColorLight = 'hsl(285, 100%, 96%)';
        appBackground = '#f3e8ff'; 
        borderRadius = '48px 0px 48px 0px'; 
        letterSpacing = '0.12em'; 
        lineSpacing = '1.9';
        elementScale = '1.05';
        shape1Radius = '80% 20% 80% 20% / 20% 80% 20% 80%';
        shape2Radius = '20% 80% 20% 80% / 80% 20% 80% 20%';
        shape1Color = 'rgba(168, 85, 247, 0.25)';
        shape2Color = 'rgba(6, 182, 212, 0.15)';
        shadowEffect = '0 20px 40px rgba(168, 85, 247, 0.12)';
        adaptiveMessage = 'Shockwave. Spiked container corners and wide typography mimic sudden startle and expansion.';
      }
    } 
    else {
      if (dominant === 'anger') {
        emotionMood = 'Serene Sea Zen';
        themeColor = 'hsl(172, 75%, 35%)'; 
        themeColorLight = 'hsl(172, 70%, 93%)';
        appBackground = '#ccfbf1'; 
        borderRadius = '120px 40px 140px 60px'; 
        letterSpacing = '0.16em'; 
        lineSpacing = '1.9';
        elementScale = '1.03';
        shape1Radius = '90% 10% 80% 20% / 70% 30% 70% 30%'; 
        shape2Radius = '80% 20% 70% 30% / 60% 40% 60% 40%';
        shape1Color = 'rgba(20, 184, 166, 0.25)';
        shape2Color = 'rgba(14, 165, 233, 0.2)';
        shadowEffect = '0 25px 50px rgba(13, 148, 136, 0.08)';
        dynamicTransition = 'all 2.4s cubic-bezier(0.1, 0.8, 0.2, 1)'; 
        adaptiveMessage = 'Tension counter-measures: Soothing sea-teals, breathing font spacing, and slow fluid contours ease visual stress.';
      }
      else if (dominant === 'sad') {
        emotionMood = 'Warm Solar Glow';
        themeColor = 'hsl(28, 95%, 48%)'; 
        themeColorLight = 'hsl(35, 100%, 95%)';
        appBackground = '#fef3c7'; 
        borderRadius = '48px'; 
        letterSpacing = '0.05em';
        lineSpacing = '1.7';
        elementScale = '1.05';
        shape1Radius = '60% 40% 60% 40% / 55% 45% 55% 45%';
        shape2Radius = '50% 50% 50% 50% / 50% 50% 50% 50%';
        shape1Color = 'rgba(245, 158, 11, 0.22)';
        shape2Color = 'rgba(236, 72, 153, 0.12)';
        shadowEffect = '0 15px 35px rgba(245, 158, 11, 0.12)';
        adaptiveMessage = 'Lifting low energy. Warm solar peach filters, expanded scales, and soft rounded borders counteract sadness.';
      }
      else if (dominant === 'happy') {
        emotionMood = 'Grounded Clay';
        themeColor = 'hsl(142, 35%, 32%)'; 
        themeColorLight = 'hsl(140, 20%, 93%)';
        appBackground = '#e8f5e9'; 
        borderRadius = '16px'; 
        letterSpacing = '0.02em';
        lineSpacing = '1.5';
        shape1Radius = '45% 55% 45% 55% / 45% 45% 55% 55%';
        shape1Color = 'rgba(34, 197, 94, 0.15)';
        shape2Color = 'rgba(115, 115, 115, 0.1)';
        adaptiveMessage = 'Stabilizing state. Centering sage-green tones and clean, structured geometries help settle intense joy.';
      }
      else if (dominant === 'surprise') {
        emotionMood = 'Anchored Focus';
        themeColor = 'hsl(215, 35%, 30%)'; 
        themeColorLight = 'hsl(215, 30%, 95%)';
        appBackground = '#f1f5f9'; 
        borderRadius = '16px'; 
        letterSpacing = '0.01em';
        lineSpacing = '1.45';
        shape1Radius = '40% 40% 40% 40% / 40% 40% 40% 40%';
        shape1Color = 'rgba(71, 85, 105, 0.15)';
        adaptiveMessage = 'Re-focusing parameters. Restores neat, stable boundaries and normal spacing to anchor attention.';
      }
    }

    return {
      themeColor,
      themeColorLight,
      appBackground,
      borderRadius,
      letterSpacing,
      lineSpacing,
      elementScale,
      borderStyle,
      primaryText,
      helperText,
      emotionMood,
      shape1Radius,
      shape2Radius,
      shape1Color,
      shape2Color,
      shadowEffect,
      adaptiveMessage,
      dynamicTransition
    };
  };

  const ui = getAdaptiveDesign();

  return (
    <div style={{
      backgroundColor: ui.appBackground,
      color: ui.primaryText,
      minHeight: '100vh',
      transition: ui.dynamicTransition,
      fontFamily: "'Outfit', 'Inter', system-ui, sans-serif",
      position: 'relative',
      overflow: 'hidden',
      paddingBottom: '60px'
    }}>
      {/* BACKGROUND FLOATING ORGANIC SHAPES */}
      <div 
        className="organic-shape-1"
        style={{
          position: 'absolute',
          top: '-10%',
          right: '5%',
          width: '500px',
          height: '500px',
          borderRadius: ui.shape1Radius,
          backgroundColor: ui.shape1Color,
          transition: ui.dynamicTransition,
          pointerEvents: 'none',
          zIndex: 0
        }}
      />
      <div 
        className="organic-shape-2"
        style={{
          position: 'absolute',
          bottom: '10%',
          left: '-5%',
          width: '450px',
          height: '450px',
          borderRadius: ui.shape2Radius,
          backgroundColor: ui.shape2Color,
          transition: ui.dynamicTransition,
          pointerEvents: 'none',
          zIndex: 0
        }}
      />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: '1280px', margin: '0 auto', padding: '30px 20px' }}>
        
        {/* HEADER BAR */}
        <header style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '40px',
          flexWrap: 'wrap',
          gap: '20px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                display: 'inline-block',
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: ui.themeColor,
                transition: ui.dynamicTransition
              }} />
              <h1 style={{
                fontSize: '28px',
                fontWeight: '700',
                margin: 0,
                letterSpacing: ui.letterSpacing,
                transition: ui.dynamicTransition
              }}>
                AURA<span style={{ color: ui.themeColor, transition: ui.dynamicTransition }}>VISAGE</span>
              </h1>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: ui.helperText, transition: ui.dynamicTransition }}>
              Emotion-Adaptive Organic UI Engine
            </p>
          </div>

          {/* MODE SELECTOR */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '15px'
          }}>
            <div style={{
              display: 'flex',
              backgroundColor: 'rgba(15, 23, 42, 0.05)',
              padding: '4px',
              borderRadius: '99px',
              border: '1px solid rgba(15, 23, 42, 0.05)'
            }}>
              <button 
                onClick={() => setMode('reflection')}
                style={{
                  padding: '8px 20px',
                  border: 'none',
                  borderRadius: '99px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '13px',
                  backgroundColor: mode === 'reflection' ? '#ffffff' : 'transparent',
                  color: mode === 'reflection' ? ui.primaryText : ui.helperText,
                  boxShadow: mode === 'reflection' ? '0 4px 12px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.3s'
                }}>
                Reflection Mode
              </button>
              <button 
                onClick={() => setMode('rectification')}
                style={{
                  padding: '8px 20px',
                  border: 'none',
                  borderRadius: '99px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '13px',
                  backgroundColor: mode === 'rectification' ? '#ffffff' : 'transparent',
                  color: mode === 'rectification' ? ui.primaryText : ui.helperText,
                  boxShadow: mode === 'rectification' ? '0 4px 12px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.3s'
                }}>
                Rectification Mode
              </button>
            </div>
          </div>
        </header>

        {/* METRICS SOURCE SWITCHER */}
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.75)',
          backdropFilter: 'blur(12px)',
          borderRadius: '16px',
          padding: '16px 20px',
          marginBottom: '30px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          border: ui.borderStyle,
          transition: ui.dynamicTransition
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Settings size={18} style={{ color: ui.themeColor }} />
            <span style={{ fontSize: '14px', fontWeight: '600' }}>Telemetry Source:</span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => {
                setControlSource('live');
                setIsCameraActive(true);
                if (modelStatus === 'not-loaded') loadFaceApi();
              }}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: controlSource === 'live' ? ui.themeColor : 'rgba(0,0,0,0.1)',
                backgroundColor: controlSource === 'live' ? ui.themeColorLight : 'transparent',
                color: controlSource === 'live' ? ui.themeColor : ui.primaryText,
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '12px',
                transition: 'all 0.3s'
              }}>
              📷 Live Camera Tracker
            </button>
            <button 
              onClick={() => {
                setControlSource('manual');
                setIsCameraActive(false);
              }}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: controlSource === 'manual' ? ui.themeColor : 'rgba(0,0,0,0.1)',
                backgroundColor: controlSource === 'manual' ? ui.themeColorLight : 'transparent',
                color: controlSource === 'manual' ? ui.themeColor : ui.primaryText,
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '12px',
                transition: 'all 0.3s'
              }}>
              🎛️ Manual Sliders
            </button>
          </div>
        </div>

        {/* MAIN WORKING GRID */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(320px, 450px) 1fr',
          gap: '30px',
          alignItems: 'start',
          // Responsive layout for tablets/mobile
          '@media (max-width: 900px)': {
            gridTemplateColumns: '1fr'
          }
        }}>
          
          {/* LEFT PANEL: TELEMETRY (CAMERA AND GRAPHS) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            
            {/* CAMERA FEED BOX */}
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: ui.borderRadius,
              padding: '24px',
              boxShadow: ui.shadowEffect,
              border: ui.borderStyle,
              transition: ui.dynamicTransition
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', fontSize: '15px' }}>
                  <Camera size={18} style={{ color: ui.themeColor }} /> Live Visage Feed
                </div>
                {controlSource === 'live' && (
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    color: modelStatus === 'ready' ? '#10b981' : modelStatus === 'loading' ? '#f59e0b' : '#ef4444',
                    textTransform: 'uppercase',
                    backgroundColor: modelStatus === 'ready' ? '#ecfdf5' : modelStatus === 'loading' ? '#fffbeb' : '#fef2f2',
                    padding: '2px 8px',
                    borderRadius: '4px'
                  }}>
                    {modelStatus === 'ready' ? 'Tracking' : modelStatus === 'loading' ? 'Loading models...' : 'Offline'}
                  </span>
                )}
              </div>

              <div style={{
                width: '100%',
                height: '260px',
                backgroundColor: '#0f172a',
                borderRadius: '16px',
                overflow: 'hidden',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.2)'
              }}>
                {controlSource === 'live' ? (
                  <>
                    <video 
                      ref={videoRef}
                      playsInline
                      muted
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transform: 'scaleX(-1)',
                        zIndex: 1
                      }}
                    />
                    <canvas 
                      ref={canvasRef}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transform: 'scaleX(-1)',
                        zIndex: 2,
                        pointerEvents: 'none'
                      }}
                    />
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '20px', zIndex: 1 }}>
                    <span style={{ color: '#94a3b8', fontSize: '13px' }}>
                      Manual Controls Active (Adjust metrics below)
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* EMOTION STATS BREAKDOWN */}
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: ui.borderRadius,
              padding: '24px',
              boxShadow: ui.shadowEffect,
              border: ui.borderStyle,
              transition: ui.dynamicTransition
            }}>
              <h3 style={{ fontSize: '15px', fontWeight: '600', marginTop: 0, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sliders size={18} style={{ color: ui.themeColor }} /> Visage Telemetry
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {Object.entries(emotions).map(([emotion, value]) => {
                  let barColor = 'hsl(215, 15%, 60%)'; 
                  if (emotion === 'happy') barColor = '#eab308';
                  else if (emotion === 'sad') barColor = '#3b82f6';
                  else if (emotion === 'anger') barColor = '#ef4444';
                  else if (emotion === 'surprise') barColor = '#a855f7';

                  return (
                    <div key={emotion}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', textTransform: 'uppercase', marginBottom: '6px', fontWeight: '600', letterSpacing: '0.05em' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          {emotion === 'happy' && <Smile size={14} style={{ color: '#eab308' }} />}
                          {emotion === 'sad' && <Frown size={14} style={{ color: '#3b82f6' }} />}
                          {emotion === 'anger' && <Flame size={14} style={{ color: '#ef4444' }} />}
                          {emotion === 'surprise' && <Zap size={14} style={{ color: '#a855f7' }} />}
                          {emotion}
                        </span>
                        <span>{value}%</span>
                      </div>
                      
                      <div style={{ width: '100%', height: '8px', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ 
                          height: '100%', 
                          width: `${value}%`, 
                          backgroundColor: barColor,
                          transition: 'width 0.8s cubic-bezier(0.2, 0.8, 0.2, 1)'
                        }} />
                      </div>

                      {/* Manual Slider if manual mode selected */}
                      {controlSource === 'manual' && (
                        <input 
                          type="range"
                          min="0"
                          max="100"
                          value={value}
                          onChange={(e) => handleManualEmotionChange(emotion, e.target.value)}
                          style={{
                            width: '100%',
                            marginTop: '8px',
                            accentColor: barColor
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* FACIAL WARPING METRICS */}
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: ui.borderRadius,
              padding: '24px',
              boxShadow: ui.shadowEffect,
              border: ui.borderStyle,
              transition: ui.dynamicTransition
            }}>
              <h3 style={{ fontSize: '15px', fontWeight: '600', marginTop: 0, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Award size={18} style={{ color: ui.themeColor }} /> Facial Warping Indicators
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {Object.entries(warpMetrics).map(([metric, value]) => {
                  const displayName = metric
                    .replace(/([A-Z])/g, ' $1')
                    .replace(/^./, (str) => str.toUpperCase());

                  return (
                    <div 
                      key={metric}
                      style={{
                        backgroundColor: '#f8fafc',
                        borderRadius: '16px',
                        padding: '12px 14px',
                        border: '1px solid rgba(0,0,0,0.02)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', color: ui.helperText, marginBottom: '4px' }}>
                        {displayName}
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                        <span style={{ fontSize: '20px', fontWeight: '700', color: ui.themeColor, transition: ui.dynamicTransition }}>
                          {value}
                        </span>
                        <span style={{ fontSize: '10px', color: '#94a3b8' }}>%</span>
                      </div>

                      {/* Micro progress meter */}
                      <div style={{ width: '100%', height: '4px', backgroundColor: '#e2e8f0', borderRadius: '2px', marginTop: '8px', overflow: 'hidden' }}>
                        <div style={{ 
                          height: '100%', 
                          width: `${value}%`, 
                          backgroundColor: ui.themeColor,
                          transition: 'width 0.8s cubic-bezier(0.2, 0.8, 0.2, 1), background-color 1s'
                        }} />
                      </div>

                      {/* Manual Slider if manual mode selected */}
                      {controlSource === 'manual' && (
                        <input 
                          type="range"
                          min="0"
                          max="100"
                          value={value}
                          onChange={(e) => handleManualWarpChange(metric, e.target.value)}
                          style={{
                            width: '100%',
                            marginTop: '8px',
                            accentColor: ui.themeColor
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* RIGHT PANEL: MAIN FEATURE - THE ADAPTIVE ENVIRONMENT */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '30px'
          }}>
            
            {/* ENVIRONMENT CARD HERO */}
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: ui.borderRadius,
              padding: '40px',
              boxShadow: ui.shadowEffect,
              border: ui.borderStyle,
              transition: ui.dynamicTransition,
              transform: `scale(${ui.elementScale})`,
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '4px',
                backgroundColor: ui.themeColor,
                transition: ui.dynamicTransition
              }} />

              {/* Status Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  color: ui.themeColor,
                  transition: ui.dynamicTransition
                }}>
                  Current Mood State: {ui.emotionMood.toUpperCase()}
                </span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  color: ui.primaryText,
                  backgroundColor: ui.themeColorLight,
                  padding: '4px 12px',
                  borderRadius: '99px',
                  transition: ui.dynamicTransition
                }}>
                  {mode.toUpperCase()}
                </span>
              </div>

              <h2 style={{
                fontSize: '32px',
                fontWeight: '700',
                marginTop: 0,
                marginBottom: '16px',
                letterSpacing: ui.letterSpacing,
                lineHeight: '1.25',
                transition: ui.dynamicTransition
              }}>
                Sophisticated Responsive Environment
              </h2>

              <p style={{
                fontSize: '15px',
                lineHeight: ui.lineSpacing,
                letterSpacing: ui.letterSpacing,
                color: ui.helperText,
                marginBottom: '32px',
                transition: ui.dynamicTransition
              }}>
                {ui.adaptiveMessage}
              </p>

              {/* DYNAMIC TEXT NODE (JOURNAL INPUT) */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '8px',
                  color: ui.themeColor,
                  transition: ui.dynamicTransition
                }}>
                  Visage Emotion Journal Node
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input 
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEntry();
                    }}
                    placeholder="Log your thoughts... typography adapts to your visage."
                    style={{
                      flex: 1,
                      padding: '14px 18px',
                      boxSizing: 'border-box',
                      border: ui.borderStyle,
                      borderRadius: ui.borderRadius,
                      fontFamily: 'inherit',
                      fontSize: '14px',
                      letterSpacing: ui.letterSpacing,
                      outline: 'none',
                      transition: ui.dynamicTransition,
                      backgroundColor: ui.themeColorLight
                    }}
                  />
                </div>
              </div>

              {/* GRID OF MORPHING CARDS */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '20px',
                marginBottom: '32px'
              }}>
                
                <div style={{
                  backgroundColor: ui.themeColorLight,
                  padding: '20px',
                  borderRadius: ui.borderRadius,
                  border: ui.borderStyle,
                  transition: ui.dynamicTransition,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <Heart size={20} style={{ color: ui.themeColor, transition: ui.dynamicTransition }} />
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '600' }}>Empathy Layer</h4>
                  <p style={{ margin: 0, fontSize: '12px', color: ui.helperText, transition: ui.dynamicTransition }}>
                    Calculates color harmonies based on emotional balance.
                  </p>
                </div>

                <div style={{
                  backgroundColor: ui.themeColorLight,
                  padding: '20px',
                  borderRadius: ui.borderRadius,
                  border: ui.borderStyle,
                  transition: ui.dynamicTransition,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <Compass size={20} style={{ color: ui.themeColor, transition: ui.dynamicTransition }} />
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '600' }}>Structural Morphing</h4>
                  <p style={{ margin: 0, fontSize: '12px', color: ui.helperText, transition: ui.dynamicTransition }}>
                    Sharp corners represent tension; organic radii represent calm.
                  </p>
                </div>

              </div>

              {/* MORPHING ACTION BUTTONS */}
              <div style={{
                display: 'flex',
                gap: '15px',
                flexWrap: 'wrap'
              }}>
                <button 
                  onClick={handleSaveEntry}
                  disabled={!inputText.trim()}
                  style={{
                    flex: 1,
                    backgroundColor: ui.themeColor,
                    color: '#ffffff',
                    border: 'none',
                    padding: '16px 28px',
                    borderRadius: ui.borderRadius,
                    fontWeight: '600',
                    fontSize: '14px',
                    cursor: inputText.trim() ? 'pointer' : 'not-allowed',
                    opacity: inputText.trim() ? 1 : 0.6,
                    boxShadow: inputText.trim() ? `0 8px 24px ${ui.themeColor}30` : 'none',
                    transition: ui.dynamicTransition,
                    letterSpacing: ui.letterSpacing
                  }}>
                  Uplink Primary Entry
                </button>

                <button 
                  onClick={() => setInputText('')}
                  style={{
                    backgroundColor: 'transparent',
                    border: `1.5px solid ${ui.themeColor}`,
                    color: ui.themeColor,
                    padding: '16px 28px',
                    borderRadius: ui.borderRadius,
                    fontWeight: '600',
                    fontSize: '14px',
                    cursor: 'pointer',
                    transition: ui.dynamicTransition,
                    letterSpacing: ui.letterSpacing
                  }}>
                  Clear Input
                </button>
              </div>

            </div>

            {/* ADAPTIVE INSTRUCTION CARD */}
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.45)',
              backdropFilter: 'blur(10px)',
              borderRadius: ui.borderRadius,
              padding: '20px 24px',
              display: 'flex',
              gap: '12px',
              alignItems: 'center',
              border: ui.borderStyle,
              transition: ui.dynamicTransition
            }}>
              <Info size={20} style={{ color: ui.themeColor, flexShrink: 0, transition: ui.dynamicTransition }} />
              <span style={{ fontSize: '13px', color: ui.helperText, transition: ui.dynamicTransition }}>
                💡 <strong>Try this:</strong> If you are using manual mode, slide <strong>Anger</strong> to 90% and observe the buttons sharpen in Reflection mode, then switch to Rectification mode to witness them transform into fluid, calming shapes.
              </span>
            </div>

            {/* MORPHED JOURNAL JOURNAL/AURA LOGS */}
            {journalEntries.length > 0 && (
              <div style={{
                backgroundColor: '#ffffff',
                borderRadius: ui.borderRadius,
                padding: '28px',
                boxShadow: ui.shadowEffect,
                border: ui.borderStyle,
                transition: ui.dynamicTransition
              }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginTop: 0, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  📜 Visage Aura Log History ({journalEntries.length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
                  {journalEntries.map((entry) => (
                    <div 
                      key={entry.id}
                      style={{
                        backgroundColor: 'rgba(15, 23, 42, 0.02)',
                        borderRadius: '16px',
                        padding: '16px',
                        borderLeft: `4px solid ${entry.themeColor}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        transition: 'all 0.3s'
                      }}
                    >
                      <div style={{ flex: 1, marginRight: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <span style={{
                            fontSize: '10px',
                            fontWeight: '700',
                            textTransform: 'uppercase',
                            backgroundColor: entry.themeColor + '15',
                            color: entry.themeColor,
                            padding: '2px 8px',
                            borderRadius: '4px'
                          }}>
                            {entry.mood} ({entry.moodPercentage}%)
                          </span>
                          <span style={{
                            fontSize: '10px',
                            fontWeight: '600',
                            backgroundColor: 'rgba(0,0,0,0.04)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            color: '#64748b'
                          }}>
                            {entry.mode}
                          </span>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>{entry.timestamp}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.5', color: '#334155' }}>
                          "{entry.text}"
                        </p>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '10px', color: '#94a3b8' }}>Eyebrow Lift: {entry.warps.eyebrowLift}%</span>
                          <span style={{ fontSize: '10px', color: '#94a3b8' }}>Smile: {entry.warps.smileIntensity}%</span>
                          <span style={{ fontSize: '10px', color: '#94a3b8' }}>Mouth Stretch: {entry.warps.mouthOpenness}%</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDeleteEntry(entry.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          padding: '4px',
                          borderRadius: '6px',
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                        onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

        </div>

      </div>
    </div>
  );
}
