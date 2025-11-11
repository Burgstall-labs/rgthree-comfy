"""The Fast Groups Bypasser node."""
from .constants import get_category, get_name


class FastGroupsBypasser:
  """The Fast Groups Bypasser node that allows bypassing groups via boolean input."""

  NAME = get_name("Fast Groups Bypasser")
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
  FUNCTION = "bypass"

  def bypass(self, enabled=True):  # pylint: disable = missing-function-docstring
    """Virtual node - logic handled in frontend."""
    return (None,)

