import React from 'react';
import {
  Flag,
  Coffee,
  MailOpen,
  Stethoscope,
  Wrench,
  ShieldAlert,
  Sparkles,
  DollarSign,
  Activity,
  FileText,
  Building,
  HeartPulse,
  Flame,
  Siren,
  Hospital,
  AlertTriangle,
  Award,
  Zap,
  TrendingUp,
  CircleDollarSign,
  BriefcaseMedical,
  Cross,
  UserCheck,
  Receipt,
  GraduationCap,
  Scale,
  Smile,
  Truck,
  HelpCircle,
} from 'lucide-react';

interface TileIconProps {
  name: string;
  className?: string;
  size?: number;
}

const ICON_MAP: Record<string, React.ElementType> = {
  Flag,
  Coffee,
  MailOpen,
  Stethoscope,
  Wrench,
  ShieldAlert,
  Sparkles,
  DollarSign,
  Activity,
  FileText,
  Building,
  HeartPulse,
  Flame,
  Siren,
  Hospital,
  AlertTriangle,
  Award,
  Zap,
  TrendingUp,
  CircleDollarSign,
  BriefcaseMedical,
  Cross,
  UserCheck,
  Receipt,
  GraduationCap,
  Scale,
  Smile,
  Truck,
};

export const TileIcon: React.FC<TileIconProps> = ({ name, className = '', size = 20 }) => {
  const IconComponent = ICON_MAP[name] || HelpCircle;
  return <IconComponent className={className} size={size} />;
};
