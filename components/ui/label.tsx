import * as React from 'react'

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, htmlFor, children, ...props }, ref) => (
    <label
      ref={ref}
      htmlFor={htmlFor}
      className={className}
      {...props}
    >
      {children}
    </label>
  )
)
Label.displayName = 'Label'

export { Label }