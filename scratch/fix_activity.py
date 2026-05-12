
import os

filepath = r'c:\Users\Perry\רשת תיכוני טומשין בע מ (חל ץ)\צהרונים - מסמכים\פרי\הורדות\Ganscheduler-main\Ganscheduler\activity.js'

with open(filepath, 'rb') as f:
    content = f.read()

# We need to find the start of the corruption and the end of it.
# The corruption starts around where _renderDashCard was.
# Looking at the powershell output, it's inside the list.innerHTML assignment.

# Let's try to find the part before and after the mess.
# Before: list.innerHTML = html || `<div style="padding:40px; text-align:center; color:#94a3b8">
# After: window.dashCheckAll = function(groupId, checked) {

try:
    # Try decoding as utf-8 first
    text = content.decode('utf-8', errors='replace')
    
    # Locate the beginning of the innerHTML assignment
    start_marker = 'list.innerHTML = html || `<div style="padding:40px; text-align:center; color:#94a3b8">'
    end_marker = 'window.dashCheckAll = function(groupId, checked) {'
    
    start_idx = text.find(start_marker)
    end_idx = text.find(end_marker)
    
    if start_idx != -1 and end_idx != -1:
        # We want to keep everything up to the end of the div inside innerHTML
        # And then put the clean _renderDashCard function.
        
        # The div ends with </div>`;
        div_end = '</div>`;'
        div_end_idx = text.find(div_end, start_idx)
        
        if div_end_idx != -1:
            clean_prefix = text[:div_end_idx + len(div_end)]
            clean_suffix = text[end_idx:]
            
            new_function = """

function _renderDashCard(card) {
  const { type, obj, evs } = card;
  const isSolo = type === 'solo';
  const firstG = window.G(evs[0].g);
  const clr = window.CITY_COLORS ? window.CITY_COLORS(firstG.city) : {solid:'#1a237e', light:'#f8fafc', border:'#e2e8f0'};

  return window.ui.renderStandardPairCard(obj, evs, {
    ds: evs[0].d,
    clr: clr,
    context: 'dash',
    isSolo: isSolo
  });
}

"""
            final_content = clean_prefix + new_function + clean_suffix
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(final_content)
            print("Successfully fixed activity.js")
        else:
            print("Could not find div_end")
    else:
        print(f"Could not find markers. start: {start_idx}, end: {end_idx}")

except Exception as e:
    print(f"Error: {e}")
