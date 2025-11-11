"""The Fast Groups Muter Remote node."""
from .constants import get_category, get_name


class FastGroupsMuterRemote:
  """The Fast Groups Muter Remote node that allows muting groups via boolean input."""

  NAME = get_name("Fast Groups Muter Remote")
  CATEGORY = get_category()

  @classmethod
  def INPUT_TYPES(cls):  # pylint: disable = invalid-name, missing-function-docstring
    return {
      "required": {},
      "optional": {
        "enabled": ("BOOLEAN", {"default": True, "forceInput": True}),
      },
    }

  RETURN_TYPES = ("*",)
  RETURN_NAMES = ("OPT_CONNECTION",)
  FUNCTION = "mute"

  def mute(self, enabled=True):  # pylint: disable = missing-function-docstring
    """Virtual node - logic handled in frontend."""
    return (None,)

