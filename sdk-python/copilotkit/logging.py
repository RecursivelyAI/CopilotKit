"""
Logging setup for CopilotKit.
"""

import logging
import os
import sys

def get_logger(name: str):
    """
    Get a logger with the given name.
    """
    logger = logging.getLogger(name)
    log_level = os.getenv('LOG_LEVEL')
    if log_level:
        logger.setLevel(log_level.upper())
    return logger

def bold(text: str) -> str:
    """
    Bold the given text.
    """
    if hasattr(sys.stdout, 'isatty') and sys.stdout.isatty():
        return f"\033[1m{text}\033[0m"
    return text
