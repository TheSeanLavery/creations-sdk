// Simple rectangle quadtree for broad-phase collision queries

function rectIntersects(a, b) {
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y)
}

export class QuadTreeNode {
  constructor(bounds, capacity, depth, maxDepth) {
    this.bounds = bounds // {x,y,w,h}
    this.capacity = capacity
    this.depth = depth
    this.maxDepth = maxDepth
    this.items = [] // {x,y,w,h, ref}
    this.children = null // [nw, ne, sw, se]
  }

  subdivide() {
    const { x, y, w, h } = this.bounds
    const hw = w * 0.5
    const hh = h * 0.5
    const d = this.depth + 1
    const cap = this.capacity
    const md = this.maxDepth
    this.children = [
      new QuadTreeNode({ x, y, w: hw, h: hh }, cap, d, md),
      new QuadTreeNode({ x: x + hw, y, w: hw, h: hh }, cap, d, md),
      new QuadTreeNode({ x, y: y + hh, w: hw, h: hh }, cap, d, md),
      new QuadTreeNode({ x: x + hw, y: y + hh, w: hw, h: hh }, cap, d, md),
    ]
  }

  insert(item) {
    if (!rectIntersects(this.bounds, item)) return false
    if (!this.children && (this.items.length < this.capacity || this.depth >= this.maxDepth)) {
      this.items.push(item)
      return true
    }
    if (!this.children) {
      this.subdivide()
      // Reinsert existing into children
      for (let i = 0; i < this.items.length; i++) {
        const it = this.items[i]
        let inserted = false
        for (let c = 0; c < 4; c++) if (this.children[c].insert(it)) { inserted = true; break }
        if (!inserted) this.items[i] = it
        else this.items[i] = this.items[this.items.length - 1], this.items.pop(), i--
      }
    }
    // Try children
    for (let c = 0; c < 4; c++) if (this.children[c].insert(item)) return true
    // If not inserted into children, keep at current node
    this.items.push(item)
    return true
  }

  query(range, out) {
    if (!rectIntersects(this.bounds, range)) return out
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i]
      if (rectIntersects(range, it)) out.push(it)
    }
    if (this.children) {
      this.children[0].query(range, out)
      this.children[1].query(range, out)
      this.children[2].query(range, out)
      this.children[3].query(range, out)
    }
    return out
  }
}

export class QuadTree {
  constructor(bounds, capacity = 16, maxDepth = 8) {
    this.root = new QuadTreeNode(bounds, capacity, 0, maxDepth)
    this.bounds = bounds
    this.capacity = capacity
    this.maxDepth = maxDepth
  }

  clear(bounds = this.bounds) {
    this.root = new QuadTreeNode(bounds, this.capacity, 0, this.maxDepth)
    this.bounds = bounds
  }

  insertRect(x, y, w, h, ref) {
    const item = { x, y, w, h, ref }
    this.root.insert(item)
  }

  queryRect(x, y, w, h, out = []) {
    return this.root.query({ x, y, w, h }, out)
  }
}


