import React from 'react';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
}

export const BrandLogo: React.FC<Props> = ({ size = 32, color }) => {
  // Website logo SVG path from web-pwa-reference/public/icon.svg
  const pathData = "M 180 0 C 221.974 0 256 34.026 256 76 L 256 256 L 208 256 L 208 76 C 208 60.536 195.464 48 180 48 C 164.536 48 152 60.536 152 76 L 152 180 C 152 221.974 117.974 256 76 256 C 34.026 256 0 221.974 0 180 L 0 0 L 48 0 L 48 180 C 48 195.464 60.536 208 76 208 C 91.464 208 104 195.464 104 180 L 104 76 C 104 34.026 138.026 0 180 0 Z";

  return (
    <Svg width={size} height={size} viewBox="0 0 256 256">
      <Defs>
        <LinearGradient id="brandCyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#42FDD3" />
          <Stop offset="100%" stopColor="#00E5BC" />
        </LinearGradient>
      </Defs>
      <Path 
        d={pathData} 
        fill={color || "url(#brandCyanGrad)"} 
      />
    </Svg>
  );
};
