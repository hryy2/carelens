import React from 'react';
import { Info } from 'lucide-react';

interface DisclaimerProps {
  text: string;
}

export const Disclaimer: React.FC<DisclaimerProps> = ({ text }) => (
  <div className="flex items-center justify-center gap-1.5 text-center pt-2 pb-1">
    <Info className="w-4 h-4 text-[#94A3B8] shrink-0" />
    <p className="text-[13px] text-[#94A3B8]">{text}</p>
  </div>
);