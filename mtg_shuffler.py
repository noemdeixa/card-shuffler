#-*-coding:utf8;-*-
#qpy:console

"""
USE INSTRUCTIONS
Pretty sure needs font size 12 points to show correctly.

The program will show a 2x5 table, representing 10 stacks in which you will need to put cards in sequence.
If you need more time, set the TIME_SHOW and TIME_HIDE constants to a higher value. You will need to put all cards in stacks
a total number of 2 times. After that, the deck is ensured to be perfectly shuffled.

For more information about how this is done, consult the create_stack_iterator function.

This is limited to decks of up to 100 cards. Change the number of cards in your deck with the CARDS constant.
"""

from math import log, ceil
from functools import reduce
from secrets import choice
from time import sleep, time

# Time to show and hide instruction
TIME_SHOW = 0.3
TIME_HIDE = 0.7

# Total cards in deck
CARDS = 100

# If None, it will generate a random permutation
DEBUG_PERMUTATION = None
assert (DEBUG_PERMUTATION is None) or len(DEBUG_PERMUTATION) == CARDS, f"DEBUG_PERMUTATION has length {len(DEBUG_PERMUTATION)}, it should have length {CARDS}."

# Number of stacks in which cards
# will be separated when shuffling
# More than 15 are not supported
STACKS = 15
assert STACKS <= 15, "More than 15 stacks not supported"

# More info in the create_stack_iterator function
SHUFFLES = ceil(log(CARDS, STACKS))

TOTAL_ESTIMATED_TIME = ceil((TIME_SHOW + TIME_HIDE) * (CARDS * SHUFFLES))

# For display purposes
CURSOR_UP_ONE = '\x1b[1A'
ERASE_LINE = '\x1b[2K'
WIDTH = 46
HEIGHT= 16
OFFSET= 8

# For drawing the box
LIGHT_VERTICAL = "\u2502"
LIGHT_HORIZONTAL = "\u2500"
LIGHT_DR = "\u250C"
LIGHT_DL = "\u2510"
LIGHT_UR = "\u2514"
LIGHT_UL = "\u2518"
LIGHT_VERTICAL_L = "\u2524"
LIGHT_VERTICAL_R = "\u251C"
LIGHT_HORIZONTAL_D = "\u252C"
LIGHT_HORIZONTAL_U = "\u2534"
LIGHT_CROSS = "\u253C"
LIGHT_CROSS_L = "\u2524"
LIGHT_CROSS_R = "\u251C"

# Size of a box in a 2x5 display
BOX_SIZE_HORIZONTAL = (WIDTH - 6) // 5
BOX_SIZE_VERTICAL = BOX_SIZE_HORIZONTAL // 2
BOX_HEIGHT = BOX_SIZE_VERTICAL * 3 + 4

# Symbols to show inside box
DOUBLE_ARROW_L = "\u255F"
DOUBLE_ARROW_R = "\u2561"

DOUBLE_ARROW_LU = "\u2554"
DOUBLE_ARROW_LD = "\u255A"

DOUBLE_ARROW_RU = "\u2557"
DOUBLE_ARROW_RD = "\u255D"

SIMPLE_ARROW_L = "\u251C"
SIMPLE_ARROW_R = "\u2524"

SIMPLE_ARROW_LU = "\u250C"
SIMPLE_ARROW_LD = "\u2514"

SIMPLE_ARROW_RU = "\u2510"
SIMPLE_ARROW_RD = "\u2518"

SIMPLE_ARROW_U = "\u252C"
SIMPLE_ARROW_D = "\u2534"

CENTER = "\u253C"

EMPTY = "\u2800"

# From left-right, up-down
BOX_SYMBOLS = [
    [DOUBLE_ARROW_LU, SIMPLE_ARROW_LU, SIMPLE_ARROW_U, SIMPLE_ARROW_RU, DOUBLE_ARROW_RU],
    [DOUBLE_ARROW_L, SIMPLE_ARROW_L, CENTER, SIMPLE_ARROW_R, DOUBLE_ARROW_R],
    [DOUBLE_ARROW_LD, SIMPLE_ARROW_LD, SIMPLE_ARROW_D, SIMPLE_ARROW_RD, DOUBLE_ARROW_RD],
]

def generate_random_permutation():
    if DEBUG_PERMUTATION is not None: return DEBUG_PERMUTATION

    # This should work correctly up to a length of 2080, check 'shuffle' docs
    assert CARDS <= 2080, "With more than 2080 cards, a uniform random permutation cannot be ensured."

    
    #objective = tuple(sample(current, len(current)))
    current = list(range(CARDS))
    objective = tuple()

    while (len(current) > 0):
        x = choice(current)
        current.remove(x)

        objective += (x,)
    
    return objective
    

def clear(n):
    # Clears n lines and flushes so that the screen is instantly shown in black
    print((CURSOR_UP_ONE + ERASE_LINE)*n, end = "", flush = True)

def go_up_lines(n):
    # Goes up n lines without flushing
    print(CURSOR_UP_ONE * n, end = "")

def create_stack_iterator():
    # Return in which stack (BIN) to put the current card 
    # This is a coroutine, it expects to be called CARDS*SHUFFLES times

    # First, select a random permutation to put the cards in, this state
    # will be reached after n 'shuffles'. A shuffle is putting the cards
    # sequentially in the assigned stack and then stacking them all in
    # ascending order
    objective = generate_random_permutation()

    # Then, it is important to note that at each shuffle the cards will be reversed, since they
    # are stacked. This means that in our last shuffle they have to be reversed, and in each other
    # previous we have to alternate.
    # Since we know how many shuffles there are gonna be, the first can be computed
    reverse = SHUFFLES % 2 == 0

    # We start sorting groups of STACKS**0 cards, that is, using all our piles, order the first
    # group of STACK cards. Then we can order groups of STACKS**1 cards and so on, alternating
    # if we reverse them.
    current = tuple(range(CARDS))
    for p in range(SHUFFLES):
        stacks = [tuple()]*STACKS

        for c in current:
            output = (objective.index(c) // (STACKS**p)) % STACKS
            if reverse:
                output = (STACKS-1) - output

            stacks[output] = (c,) + stacks[output]
            yield output

        # Alternate
        reverse = not reverse

        # Restack them
        current = reduce(lambda h, acc: h + acc, stacks)

    # Shouldn't be called anymore
    raise Exception(f"Stack iterator called more than (CARDS * SHUFFLES = {CARDS}*{SHUFFLES} = {CARDS*SHUFFLES}) times.")
        
    
STACK_ITERATOR = create_stack_iterator()
    
def display10(empty = False):
    """
    Draw a 2x5 box and fill the selected cell with a symbol.
    """
    n = next(STACK_ITERATOR) if not empty else -1
    x = n % 5
    y = n // 5
    box_build = ""

    # ROW 1
    box_build += LIGHT_DR + LIGHT_HORIZONTAL_D.join([LIGHT_HORIZONTAL * BOX_SIZE_HORIZONTAL, ] * 5) + LIGHT_DL + "\n"
    box_build += (LIGHT_VERTICAL + LIGHT_VERTICAL.join([(EMPTY + (BOX_SYMBOLS[y][x] if (i == x and y == 0) else EMPTY) * (BOX_SIZE_HORIZONTAL - 2) + EMPTY) for i in range(5)]) + LIGHT_VERTICAL + "\n") * BOX_SIZE_VERTICAL
    
    # ROW 2
    box_build += LIGHT_VERTICAL_R + LIGHT_CROSS.join([LIGHT_HORIZONTAL * BOX_SIZE_HORIZONTAL, ] * 5) + LIGHT_VERTICAL_L + "\n"
    box_build += (LIGHT_VERTICAL + LIGHT_VERTICAL.join([(EMPTY + (BOX_SYMBOLS[y][x] if (i == x and y == 1) else EMPTY) * (BOX_SIZE_HORIZONTAL - 2) + EMPTY) for i in range(5)]) + LIGHT_VERTICAL + "\n") * BOX_SIZE_VERTICAL
    
    # ROW 3
    box_build += LIGHT_CROSS_R + LIGHT_CROSS.join([LIGHT_HORIZONTAL * BOX_SIZE_HORIZONTAL, ] * 5) + LIGHT_CROSS_L + "\n"
    box_build += (LIGHT_VERTICAL + LIGHT_VERTICAL.join([(EMPTY + (BOX_SYMBOLS[y][x] if (i == x and y == 2) else EMPTY) * (BOX_SIZE_HORIZONTAL - 2) + EMPTY) for i in range(5)]) + LIGHT_VERTICAL + "\n") * BOX_SIZE_VERTICAL
    box_build += LIGHT_UR + LIGHT_HORIZONTAL_U.join([LIGHT_HORIZONTAL * BOX_SIZE_HORIZONTAL, ] * 5) + LIGHT_UL

    print(box_build, flush = True, end = "\n")

def get_remaining_time(time_passed):
    estimated = ceil(TOTAL_ESTIMATED_TIME - time_passed)
    TOTAL_ESTIMATED_MINUTES = estimated // 60
    TOTAL_ESTIMATED_SECONDS = estimated % 60

    return TOTAL_ESTIMATED_MINUTES, TOTAL_ESTIMATED_SECONDS


# Clear first lines in console so that screen is fully black
clear(4)

# Offset so that is more centered
print("\n"*OFFSET)

time_spent = 0

for shuffle in range(1, SHUFFLES+1):
    print("Estimated time: {:02d}:{:02d}".format(*get_remaining_time(time_spent)))
    print("Shuffles done: {} / {}".format(shuffle-1, SHUFFLES))
    input("<ENTER> when ready for next shuffle")
    clear(4)

    start_time = time()
    for i in range(1, CARDS+1):
        print("Estimated remaining time: {:02d}:{:02d}".format(*get_remaining_time(time_spent + (time() - start_time))))
        print("Shuffle number: {} / {}".format(
              shuffle, SHUFFLES
          )
        )
        
        print("Card number: {} / {}".format(i, CARDS))
        print()

        # Show box
        display10()
        sleep(TIME_SHOW)
        go_up_lines(BOX_HEIGHT)
        display10(empty=True)
        sleep(TIME_HIDE)
        clear(BOX_HEIGHT)

        # +4 to account for the card number,
        # shuffle numbers, spacing with box and estimated time
        clear(4)

    time_spent += (time() - start_time)
    