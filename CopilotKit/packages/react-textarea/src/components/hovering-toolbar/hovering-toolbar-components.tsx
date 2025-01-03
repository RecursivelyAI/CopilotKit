import { css, cx } from "@emotion/css";
import React, { PropsWithChildren, Ref } from "react";
import ReactDOM from "react-dom";

interface BaseProps {
  className: string;
  [key: string]: unknown;
}

export const Button = React.forwardRef(
    // @ts-expect-error -- forward ref is not supported in react 19. We are backwards compatible here
  (
    {
      className,
      active,
      reversed,
      ...props
    }: PropsWithChildren<
      {
        active: boolean;
        reversed: boolean;
      } & BaseProps
    >,
    ref: Ref<HTMLSpanElement | null>,
  ) => (
    <span
      {...props}
      ref={ref as Ref<HTMLSpanElement>}
      className={cx(
        className,
        css`
          cursor: pointer;
          color: ${reversed ? (active ? "white" : "#aaa") : active ? "black" : "#ccc"};
        `,
      )}
    />
  ),
);

export const Icon = React.forwardRef(
    // @ts-expect-error -- forward ref is not supported in react 19. We are backwards compatible here
  ({ className, ...props }: PropsWithChildren<BaseProps>, ref: Ref<HTMLSpanElement | null>) => (
    <span
      {...props}
      ref={ref as Ref<HTMLSpanElement>}
      className={cx(
        "material-icons",
        className,
        css`
          font-size: 18px;
          vertical-align: text-bottom;
        `,
      )}
    />
  ),
);

export const Menu = React.forwardRef(
    // @ts-expect-error -- forward ref is not supported in react 19. We are backwards compatible here
  ({ className, ...props }: PropsWithChildren<BaseProps>, ref: Ref<HTMLDivElement | null>) => {
    return (
      <div
        {...props}
        data-testid="menu"
        ref={ref as Ref<HTMLDivElement>}
        className={cx(
          className,
          css`
            & > * {
              display: inline-block;
            }

            & > * + * {
              margin-left: 15px;
            }
          `,
        )}
      />
    );
  },
);
export const Portal = ({ children }: { children: React.ReactNode }) => {
  return typeof document === "object" ? ReactDOM.createPortal(children, document.body) : null;
};

export const Toolbar = React.forwardRef(
    // @ts-expect-error -- forward ref is not supported in react 19. We are backwards compatible here
  ({ className, ...props }: PropsWithChildren<BaseProps>, ref?: Ref<HTMLDivElement>) => (
    <Menu
      {...props}
      ref={ref}
      className={cx(
        className,
        css`
          position: relative;
          padding: 1px 18px 17px;
          margin: 0 -20px;
          border-bottom: 2px solid #eee;
          margin-bottom: 20px;
        `,
      )}
    />
  ),
);
