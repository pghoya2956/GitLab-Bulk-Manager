import React from 'react';
import { motion } from 'framer-motion';
import { cva, VariantProps } from 'class-variance-authority';

const cardVariants = cva(
  'relative overflow-hidden rounded-xl transition-all duration-300',
  {
    variants: {
      variant: {
        default: 'bg-gray-800 border border-gray-700',
        glass: 'glass backdrop-blur-xl border border-white/10',
        elevated: 'bg-surface-elevated shadow-lg hover:shadow-xl',
        gradient: 'bg-gradient-to-br from-gray-900/50 to-gray-800/50 border border-white/10',
      },
      padding: {
        none: 'p-0',
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
      },
      hoverable: {
        true: 'cursor-pointer hover:scale-[1.02] hover:shadow-glow',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'glass',
      padding: 'md',
      hoverable: false,
    },
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, hoverable, children, style, onClick, ...props }, ref) => {
    const cardClasses = cardVariants({ variant, padding, hoverable, className });

    if (hoverable) {
      return (
        <motion.div
          ref={ref}
          className={cardClasses}
          style={style}
          onClick={onClick}
          whileHover={{ scale: 1.02 }}
          transition={{ duration: 0.2 }}
        >
          {/* Glass effect overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
          
          {/* Content */}
          <div className="relative z-10">{children}</div>
        </motion.div>
      );
    }

    return (
      <div ref={ref} className={cardClasses} style={style} onClick={onClick} {...props}>
        {/* Glass effect overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
        
        {/* Content */}
        <div className="relative z-10">{children}</div>
      </div>
    );
  }
);

Card.displayName = 'Card';

// Card Header Component
interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  action?: React.ReactNode;
}

export const CardHeader: React.FC<CardHeaderProps> = ({ 
  children, 
  action, 
  className = '', 
  ...props 
}) => {
  return (
    <div className={`flex items-center justify-between mb-4 ${className}`} {...props}>
      <div className="flex-1">{children}</div>
      {action && <div className="flex-shrink-0 ml-4">{action}</div>}
    </div>
  );
};

CardHeader.displayName = 'CardHeader';

// Card Title Component
export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ 
  children, 
  className = '', 
  ...props 
}) => {
  return (
    <h3 className={`text-lg font-semibold text-white ${className}`} {...props}>
      {children}
    </h3>
  );
};

CardTitle.displayName = 'CardTitle';

// Card Body Component
export const CardBody: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ 
  children, 
  className = '', 
  ...props 
}) => {
  return (
    <div className={`text-gray-300 ${className}`} {...props}>
      {children}
    </div>
  );
};

CardBody.displayName = 'CardBody';

// Card Footer Component
export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ 
  children, 
  className = '', 
  ...props 
}) => {
  return (
    <div className={`mt-4 pt-4 border-t border-gray-700 ${className}`} {...props}>
      {children}
    </div>
  );
};

CardFooter.displayName = 'CardFooter';

// Export compound components
export default Object.assign(Card, {
  Header: CardHeader,
  Title: CardTitle,
  Body: CardBody,
  Footer: CardFooter,
});