import React from 'react';
import { motion } from 'framer-motion';
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/outline';
import { Card } from '../Card/Card';

interface StatsCardProps {
  title: string;
  value: number | string;
  change?: {
    value: number;
    trend: 'up' | 'down';
  };
  icon?: React.ReactNode;
  color?: 'blue' | 'green' | 'orange' | 'red';
}

const colorClasses = {
  blue: 'from-blue-500/20 to-blue-600/20 border-blue-500/20',
  green: 'from-green-500/20 to-green-600/20 border-green-500/20',
  orange: 'from-orange-500/20 to-orange-600/20 border-orange-500/20',
  red: 'from-red-500/20 to-red-600/20 border-red-500/20',
};

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  change,
  icon,
  color = 'blue',
}) => {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        variant="gradient"
        className={`bg-gradient-to-br ${colorClasses[color]} cursor-pointer`}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-400">{title}</h3>
          {icon && (
            <div className="text-gray-500">
              {icon}
            </div>
          )}
        </div>
        
        <div className="flex items-end justify-between">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="text-3xl font-bold text-white"
          >
            {value}
          </motion.div>
          
          {change && (
            <div className={`flex items-center ${
              change.trend === 'up' ? 'text-green-400' : 'text-red-400'
            }`}>
              {change.trend === 'up' ? (
                <ArrowUpIcon className="w-4 h-4 mr-1" />
              ) : (
                <ArrowDownIcon className="w-4 h-4 mr-1" />
              )}
              <span className="text-sm font-medium">
                {change.value}
              </span>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
};