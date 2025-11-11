"""The Fast Groups Bypasser Remote node."""
from .utils import FlexibleOptionalInputType
from .constants import get_category, get_name


class FastGroupsBypasserRemote:
  """The Fast Groups Bypasser Remote node that creates dynamic boolean inputs for each group."""

  NAME = get_name("Fast Groups Bypasser Remote")
  CATEGORY = get_category()

  @classmethod
  def INPUT_TYPES(cls):  # pylint: disable = invalid-name, missing-function-docstring
    return {
      "required": {},
      "optional": FlexibleOptionalInputType("BOOLEAN"),
    }

  RETURN_TYPES = ("*",)
  RETURN_NAMES = ("OPT_CONNECTION",)
  FUNCTION = "bypass"

  def bypass(self, **kwargs):  # pylint: disable = missing-function-docstring
    """Virtual node - logic handled in frontend."""
    return (None,)
