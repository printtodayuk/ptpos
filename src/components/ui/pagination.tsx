
'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button, type ButtonProps } from '@/components/ui/button';
<<<<<<< HEAD
import { Input } from '@/components/ui/input';
=======
>>>>>>> 17b9b0d58aa610a39f92457dc167e3f1bcc01956

const Pagination = ({ className, ...props }: React.ComponentProps<'nav'>) => (
  <nav
    role="navigation"
    aria-label="pagination"
    className={cn('mx-auto flex w-full justify-center', className)}
    {...props}
  />
);
Pagination.displayName = 'Pagination';

const PaginationContent = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<'ul'>
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    className={cn('flex flex-row items-center gap-1', className)}
    {...props}
  />
));
PaginationContent.displayName = 'PaginationContent';

const PaginationItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<'li'>
>(({ className, ...props }, ref) => (
  <li ref={ref} className={cn('', className)} {...props} />
));
PaginationItem.displayName = 'PaginationItem';

type PaginationLinkProps = {
  isActive?: boolean;
} & Pick<ButtonProps, 'size'> &
  React.ComponentProps<'a'>;

const PaginationLink = ({
  className,
  isActive,
  size = 'icon',
  ...props
}: PaginationLinkProps) => (
  <a
    aria-current={isActive ? 'page' : undefined}
    className={cn(
      Button.toString(),
      'h-10 w-10 p-0',
      isActive &&
        'bg-primary text-primary-foreground hover:bg-primary/90',
      !isActive && 'hover:bg-accent hover:text-accent-foreground',
      className
    )}
    {...props}
  />
);
PaginationLink.displayName = 'PaginationLink';

const PaginationPrevious = ({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) => (
  <PaginationLink
    aria-label="Go to previous page"
    size="default"
    className={cn('gap-1 pl-2.5', className)}
    {...props}
  >
    <ChevronLeft className="h-4 w-4" />
    <span>Previous</span>
  </PaginationLink>
);
PaginationPrevious.displayName = 'PaginationPrevious';

const PaginationNext = ({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) => (
  <PaginationLink
    aria-label="Go to next page"
    size="default"
    className={cn('gap-1 pr-2.5', className)}
    {...props}
  >
    <span>Next</span>
    <ChevronRight className="h-4 w-4" />
  </PaginationLink>
);
PaginationNext.displayName = 'PaginationNext';

const PaginationEllipsis = ({
  className,
  ...props
}: React.ComponentProps<'span'>) => (
  <span
    aria-hidden
    className={cn('flex h-9 w-9 items-center justify-center', className)}
    {...props}
  >
    <MoreHorizontal className="h-4 w-4" />
    <span className="sr-only">More pages</span>
  </span>
);
PaginationEllipsis.displayName = 'PaginationEllipsis';

type SimplePaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
};

const SimplePagination = ({ currentPage, totalPages, onPageChange, className }: SimplePaginationProps) => {
<<<<<<< HEAD
  const [inputPage, setInputPage] = React.useState(currentPage.toString());

  React.useEffect(() => {
    setInputPage(currentPage.toString());
  }, [currentPage]);

  const handlePageSubmit = (e: React.KeyboardEvent<HTMLInputElement> | React.FocusEvent<HTMLInputElement>) => {
    let page = parseInt(inputPage);
    if (isNaN(page) || page < 1) {
      page = 1;
    } else if (page > totalPages) {
      page = totalPages;
    }
    onPageChange(page);
    setInputPage(page.toString());
  };

  if (totalPages <= 1) return null;

  return (
    <div className={cn("flex flex-col sm:flex-row items-center justify-end text-sm text-muted-foreground gap-4 pt-4", className)}>
        <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
            >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
            </Button>
            
            <div className="flex items-center space-x-2">
              <span>Page</span>
              <Input
                type="number"
                min={1}
                max={totalPages}
                value={inputPage}
                onChange={(e) => setInputPage(e.target.value)}
                onBlur={handlePageSubmit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handlePageSubmit(e);
                  }
                }}
                className="w-16 h-8 text-center px-1"
              />
              <span>of {totalPages}</span>
            </div>

            <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage >= totalPages}
            >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
=======
  if (totalPages <= 1) return null;

  return (
    <div className={cn("flex items-center justify-between pt-4", className)}>
        <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
        </div>
        <div className="flex items-center gap-2">
            <Button
                variant="outline"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage <= 1}
            >
                <ChevronLeft className="h-4 w-4" />
                Previous
            </Button>
            <Button
                variant="outline"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
            >
                Next
                <ChevronRight className="h-4 w-4" />
>>>>>>> 17b9b0d58aa610a39f92457dc167e3f1bcc01956
            </Button>
        </div>
    </div>
  );
};

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  SimplePagination
};
