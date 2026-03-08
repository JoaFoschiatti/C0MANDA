import clsx from 'clsx';

export default function Table({ children, className, ...props }) {
  return (
    <div className="table-container overflow-x-auto">
      <table className={clsx('table', className)} {...props}>
        {children}
      </table>
    </div>
  );
}

Table.Head = function TableHead({ children, className, ...props }) {
  return <thead className={className} {...props}>{children}</thead>;
};

Table.Body = function TableBody({ children, className, ...props }) {
  return <tbody className={className} {...props}>{children}</tbody>;
};

Table.Row = function TableRow({ children, className, ...props }) {
  return <tr className={className} {...props}>{children}</tr>;
};

Table.Header = function TableHeader({ children, className, ...props }) {
  return <th className={className} {...props}>{children}</th>;
};

Table.Cell = function TableCell({ children, className, ...props }) {
  return <td className={className} {...props}>{children}</td>;
};
