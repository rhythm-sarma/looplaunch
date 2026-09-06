'use client';

import React from 'react';
import { motion, type HTMLMotionProps, type Variants } from 'motion/react';

export interface StaggerContainerProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  staggerDelay?: number;
  initialDelay?: number;
  className?: string;
  viewportAmount?: number;
}

const containerVariants = (staggerDelay: number, initialDelay: number): Variants => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      delayChildren: initialDelay,
      staggerChildren: staggerDelay,
    },
  },
});

export const StaggerContainer: React.FC<StaggerContainerProps> = ({
  children,
  staggerDelay = 0.09,
  initialDelay = 0.05,
  className = '',
  viewportAmount = 0.15,
  ...rest
}) => {
  return (
    <motion.div
      variants={containerVariants(staggerDelay, initialDelay)}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: viewportAmount }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
};

export interface StaggerItemProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  className?: string;
  yOffset?: number;
  duration?: number;
}

const itemVariants = (yOffset: number, duration: number): Variants => ({
  hidden: {
    opacity: 0,
    y: yOffset,
    scale: 0.98,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration,
      ease: [0.16, 1, 0.3, 1], // Smooth deceleration curve that pops up and gently slows into place
    },
  },
});

export const StaggerItem: React.FC<StaggerItemProps> = ({
  children,
  className = '',
  yOffset = 28,
  duration = 0.75,
  ...rest
}) => {
  return (
    <motion.div
      variants={itemVariants(yOffset, duration)}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
};

export default StaggerContainer;
