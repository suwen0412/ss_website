
"""
Toolkit 3: plotting and animation for any time-dependent data stored in Excel.

Expected Excel format
---------------------
A worksheet with at least these columns:
    1) time column (header can include the unit, e.g. "Time (s)")
    2) variable 1
    3) variable 2
    4) variable 3

Core features
-------------
- Load Excel data with a configurable skip value:
    skip=1  -> use every point
    skip=5  -> use every 5th point
- Choose 2D or 3D plotting.
- Make a 2D lag plot: variable(n) vs variable(n+skip).
- Animate a 2D or 3D trajectory.
- Customize label names and title names.

Example
-------
from toolkit3_time_dependent_plotting import *

df = load_excel_timeseries(
    "toolkit3_example_timeseries.xlsx",
    sheet_name="Example_Data",
    time_col="Time (s)",
    variable_cols=["Variable 1 (a.u.)", "Variable 2 (a.u.)", "Variable 3 (a.u.)"],
    skip=1,
)

plot_lag_2d(
    df,
    variable_col="Variable 1 (a.u.)",
    skip=1,
    xlabel="V1(n)",
    ylabel="V1(n+1)",
    title="Example lag plot",
)

anim = animate_timeseries(
    df,
    mode="3d",
    x_col="Variable 1 (a.u.)",
    y_col="Variable 2 (a.u.)",
    time_col="Time (s)",
    xlabel="Variable 1",
    ylabel="Variable 2",
    zlabel="Time (s)",
    title="3D time trajectory",
    show_full_background=True,
)
# anim.save("demo.gif", writer=PillowWriter(fps=15))
"""

from pathlib import Path
from typing import Iterable, List, Optional, Sequence, Tuple, Union

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation


def load_excel_timeseries(
    file_path: Union[str, Path],
    sheet_name: Union[str, int] = 0,
    time_col: str = "Time (s)",
    variable_cols: Optional[Sequence[str]] = None,
    skip: int = 1,
    drop_na: bool = True,
) -> pd.DataFrame:
    """
    Load an Excel worksheet as a time-dependent dataset.

    Parameters
    ----------
    file_path : str or Path
        Excel file path.
    sheet_name : str or int
        Worksheet name or index.
    time_col : str
        Name of the time column.
    variable_cols : list[str] or None
        Variable columns to keep. If None, all numeric columns except time_col are kept.
    skip : int
        Keep every `skip`-th row. Use 1 for no skipping.
    drop_na : bool
        Drop rows with missing values in required columns.

    Returns
    -------
    DataFrame
        Reduced dataframe containing the requested columns.
    """
    if skip < 1:
        raise ValueError("skip must be >= 1")

    df = pd.read_excel(file_path, sheet_name=sheet_name)

    if time_col not in df.columns:
        raise KeyError(f"Could not find time column: {time_col}")

    if variable_cols is None:
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        variable_cols = [c for c in numeric_cols if c != time_col]

    required_cols = [time_col] + list(variable_cols)
    missing = [c for c in required_cols if c not in df.columns]
    if missing:
        raise KeyError(f"Missing required columns: {missing}")

    out = df[required_cols].copy()

    if drop_na:
        out = out.dropna(subset=required_cols)

    out = out.iloc[::skip].reset_index(drop=True)
    return out


def rename_labels(
    xlabel: Optional[str] = None,
    ylabel: Optional[str] = None,
    zlabel: Optional[str] = None,
    title: Optional[str] = None,
    default_xlabel: str = "",
    default_ylabel: str = "",
    default_zlabel: str = "",
    default_title: str = "",
) -> Tuple[str, str, str, str]:
    """Return user labels if provided; otherwise return defaults."""
    return (
        xlabel if xlabel is not None else default_xlabel,
        ylabel if ylabel is not None else default_ylabel,
        zlabel if zlabel is not None else default_zlabel,
        title if title is not None else default_title,
    )


def build_lag_data(
    df: pd.DataFrame,
    variable_col: str,
    skip: int = 1,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Build lag data for variable(n) vs variable(n+skip).

    Parameters
    ----------
    df : DataFrame
    variable_col : str
        Column to lag.
    skip : int
        Next-frame gap. skip=1 means n vs n+1.

    Returns
    -------
    x, y : np.ndarray
        x = variable(n), y = variable(n+skip)
    """
    if skip < 1:
        raise ValueError("skip must be >= 1")

    signal = df[variable_col].to_numpy(dtype=float)
    if len(signal) <= skip:
        raise ValueError("Not enough points for the requested skip")

    return signal[:-skip], signal[skip:]


def plot_lag_2d(
    df: pd.DataFrame,
    variable_col: str,
    skip: int = 1,
    xlabel: Optional[str] = None,
    ylabel: Optional[str] = None,
    title: Optional[str] = None,
    scatter_kwargs: Optional[dict] = None,
    ax=None,
):
    """
    2D lag plot: variable(n) vs variable(n+skip).
    """
    x, y = build_lag_data(df, variable_col=variable_col, skip=skip)

    xlabel, ylabel, _, title = rename_labels(
        xlabel=xlabel,
        ylabel=ylabel,
        title=title,
        default_xlabel=f"{variable_col}(n)",
        default_ylabel=f"{variable_col}(n+{skip})",
        default_title=f"2D lag plot: {variable_col}(n) vs {variable_col}(n+{skip})",
    )

    if ax is None:
        fig, ax = plt.subplots(figsize=(6, 6))
    else:
        fig = ax.figure

    kwargs = {"s": 16, "alpha": 0.7}
    if scatter_kwargs:
        kwargs.update(scatter_kwargs)

    ax.scatter(x, y, **kwargs)

    lo = min(np.min(x), np.min(y))
    hi = max(np.max(x), np.max(y))
    ax.plot([lo, hi], [lo, hi], "k--", linewidth=1)

    ax.set_xlabel(xlabel)
    ax.set_ylabel(ylabel)
    ax.set_title(title)
    ax.minorticks_on()
    plt.tight_layout()
    return fig, ax


def plot_timeseries_2d(
    df: pd.DataFrame,
    time_col: str,
    y_cols: Sequence[str],
    xlabel: Optional[str] = None,
    ylabel: Optional[str] = None,
    title: Optional[str] = None,
    ax=None,
):
    """
    Standard 2D time-series plot: time vs one or more variables.
    """
    if ax is None:
        fig, ax = plt.subplots(figsize=(8, 4.5))
    else:
        fig = ax.figure

    t = df[time_col].to_numpy(dtype=float)
    for col in y_cols:
        ax.plot(t, df[col].to_numpy(dtype=float), label=col)

    xlabel, ylabel, _, title = rename_labels(
        xlabel=xlabel,
        ylabel=ylabel,
        title=title,
        default_xlabel=time_col,
        default_ylabel="Value",
        default_title="2D time-series plot",
    )

    ax.set_xlabel(xlabel)
    ax.set_ylabel(ylabel)
    ax.set_title(title)
    ax.legend()
    ax.minorticks_on()
    plt.tight_layout()
    return fig, ax


def plot_trajectory_3d(
    df: pd.DataFrame,
    x_col: str,
    y_col: str,
    z_col: str,
    mode: str = "scatter",
    xlabel: Optional[str] = None,
    ylabel: Optional[str] = None,
    zlabel: Optional[str] = None,
    title: Optional[str] = None,
    scatter_kwargs: Optional[dict] = None,
    line_kwargs: Optional[dict] = None,
    ax=None,
):
    """
    3D plot using any 3 columns, e.g. variable1, variable2, time.
    mode = 'scatter' or 'line'
    """
    if ax is None:
        fig = plt.figure(figsize=(7, 5.5))
        ax = fig.add_subplot(111, projection="3d")
    else:
        fig = ax.figure

    x = df[x_col].to_numpy(dtype=float)
    y = df[y_col].to_numpy(dtype=float)
    z = df[z_col].to_numpy(dtype=float)

    xlabel, ylabel, zlabel, title = rename_labels(
        xlabel=xlabel,
        ylabel=ylabel,
        zlabel=zlabel,
        title=title,
        default_xlabel=x_col,
        default_ylabel=y_col,
        default_zlabel=z_col,
        default_title="3D trajectory plot",
    )

    if mode == "scatter":
        kwargs = {"s": 12, "alpha": 0.65}
        if scatter_kwargs:
            kwargs.update(scatter_kwargs)
        ax.scatter(x, y, z, **kwargs)
    elif mode == "line":
        kwargs = {"linewidth": 1.0}
        if line_kwargs:
            kwargs.update(line_kwargs)
        ax.plot(x, y, z, **kwargs)
    else:
        raise ValueError("mode must be 'scatter' or 'line'")

    ax.set_xlabel(xlabel)
    ax.set_ylabel(ylabel)
    ax.set_zlabel(zlabel)
    ax.set_title(title)
    plt.tight_layout()
    return fig, ax


def animate_timeseries(
    df: pd.DataFrame,
    mode: str = "3d",
    x_col: Optional[str] = None,
    y_col: Optional[str] = None,
    time_col: str = "Time (s)",
    variable_col: Optional[str] = None,
    skip: int = 1,
    show_full_background: bool = True,
    interval: int = 60,
    marker_size: int = 60,
    xlabel: Optional[str] = None,
    ylabel: Optional[str] = None,
    zlabel: Optional[str] = None,
    title: Optional[str] = None,
):
    """
    Animate either:
      - 2D lag trajectory: variable(n) vs variable(n+skip)
      - 3D trajectory: x_col vs y_col vs time_col

    Parameters
    ----------
    mode : {'2d', '3d'}
    x_col, y_col : str
        Used for 3D animation.
    time_col : str
        Time column used as z in 3D.
    variable_col : str
        Used for 2D lag animation.
    skip : int
        Lag / frame step for 2D lag plot.
    show_full_background : bool
        If True, draw the entire trajectory/cloud and move one marker on top.
    interval : int
        Delay between frames in milliseconds.
    """
    if mode not in {"2d", "3d"}:
        raise ValueError("mode must be '2d' or '3d'")

    if mode == "2d":
        if variable_col is None:
            raise ValueError("variable_col is required for mode='2d'")

        x, y = build_lag_data(df, variable_col=variable_col, skip=skip)

        fig, ax = plt.subplots(figsize=(6, 6))
        if show_full_background:
            ax.scatter(x, y, s=16, alpha=0.35)

        head = ax.scatter([x[0]], [y[0]], s=marker_size)

        lo = min(np.min(x), np.min(y))
        hi = max(np.max(x), np.max(y))
        pad = 0.05 * (hi - lo) if hi > lo else 1.0
        ax.set_xlim(lo - pad, hi + pad)
        ax.set_ylim(lo - pad, hi + pad)
        ax.plot([lo, hi], [lo, hi], "k--", linewidth=1)

        xlabel, ylabel, _, title_txt = rename_labels(
            xlabel=xlabel,
            ylabel=ylabel,
            title=title,
            default_xlabel=f"{variable_col}(n)",
            default_ylabel=f"{variable_col}(n+{skip})",
            default_title=f"Animated 2D lag plot: {variable_col}(n) vs {variable_col}(n+{skip})",
        )
        ax.set_xlabel(xlabel)
        ax.set_ylabel(ylabel)
        ax.set_title(title_txt)

        def update(frame):
            head.set_offsets([[x[frame], y[frame]]])
            return (head,)

        anim = FuncAnimation(fig, update, frames=len(x), interval=interval, blit=False)
        plt.tight_layout()
        return anim

    # mode == "3d"
    if x_col is None or y_col is None:
        raise ValueError("x_col and y_col are required for mode='3d'")

    x = df[x_col].to_numpy(dtype=float)
    y = df[y_col].to_numpy(dtype=float)
    z = df[time_col].to_numpy(dtype=float)

    fig = plt.figure(figsize=(7, 5.5))
    ax = fig.add_subplot(111, projection="3d")

    if show_full_background:
        ax.scatter(x, y, z, s=10, alpha=0.35)

    head = ax.scatter([x[0]], [y[0]], [z[0]], s=marker_size)

    def _limits(arr):
        lo = float(np.min(arr))
        hi = float(np.max(arr))
        pad = 0.05 * (hi - lo) if hi > lo else 1.0
        return lo - pad, hi + pad

    ax.set_xlim(*_limits(x))
    ax.set_ylim(*_limits(y))
    ax.set_zlim(*_limits(z))

    xlabel, ylabel, zlabel, title_txt = rename_labels(
        xlabel=xlabel,
        ylabel=ylabel,
        zlabel=zlabel,
        title=title,
        default_xlabel=x_col,
        default_ylabel=y_col,
        default_zlabel=time_col,
        default_title=f"Animated 3D trajectory: {x_col} vs {y_col} vs {time_col}",
    )
    ax.set_xlabel(xlabel)
    ax.set_ylabel(ylabel)
    ax.set_zlabel(zlabel)
    ax.set_title(title_txt)

    def update(frame):
        head._offsets3d = ([x[frame]], [y[frame]], [z[frame]])
        return (head,)

    anim = FuncAnimation(fig, update, frames=len(x), interval=interval, blit=False)
    plt.tight_layout()
    return anim


if __name__ == "__main__":
    print("Toolkit 3 loaded. Import functions from this file in your notebook or script.")
